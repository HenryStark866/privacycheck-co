/**
 * Helpers de Firestore para el servidor (Admin SDK).
 *
 * NOTA sobre índices: Firestore exige índices compuestos para
 * combinaciones de .where() + .orderBy(). Para evitar ese error
 * en desarrollo, hacemos el ordenamiento en JavaScript después
 * de traer los datos. El archivo firestore.indexes.json define
 * los índices para producción.
 */
import { adminDb } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  nit?: string;
  sector?: string;
  size?: string;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp | Date;
}

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: 'administrador' | 'evaluador' | 'auditor';
}

export interface Evaluation {
  id: string;
  companyId: string;
  createdBy: string;
  status: 'borrador' | 'completada';
  score?: number;
  blockA?: number;
  blockB?: number;
  blockC?: number;
  maturity?: string;
  createdAt: FirebaseFirestore.Timestamp | Date;
  completedAt?: FirebaseFirestore.Timestamp | Date;
}

/** Convierte un Timestamp de Firestore o Date a milisegundos para ordenar */
function toMs(ts: FirebaseFirestore.Timestamp | Date | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  // Firestore Timestamp tiene .toMillis()
  return (ts as FirebaseFirestore.Timestamp).toMillis?.() ?? 0;
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function getCompaniesByUser(uid: string, systemRole?: string): Promise<Array<Company & { role: string }>> {
  const roleToUse = systemRole || (await getSystemRole(uid));
  if (roleToUse === 'admin') {
    const snap = await adminDb.collection('companies').get();
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'administrador' } as Company & { role: string }));
    return results.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  }

  // Query simple de un solo campo — NO necesita índice compuesto
  const memSnap = await adminDb
    .collection('memberships')
    .where('userId', '==', uid)
    .get();

  const results: Array<Company & { role: string }> = [];
  // Fetch en paralelo para mejorar rendimiento
  const companyFetches = memSnap.docs.map(async (mem) => {
    const { companyId, role } = mem.data();
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (companyDoc.exists) {
      results.push({ id: companyDoc.id, ...companyDoc.data(), role } as Company & { role: string });
    }
  });
  await Promise.all(companyFetches);

  // Ordenar en JS — más reciente primero
  return results.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export async function getCompany(id: string): Promise<Company | null> {
  const docSnap = await adminDb.collection('companies').doc(id).get();
  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...docSnap.data() } as Company;
}

export async function createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<string> {
  const ref = await adminDb.collection('companies').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateCompany(
  id: string,
  data: Partial<Pick<Company, 'name' | 'nit' | 'sector' | 'size'>>,
) {
  const clean: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  (['name', 'nit', 'sector', 'size'] as const).forEach((k) => {
    if (data[k] !== undefined) clean[k] = data[k];
  });
  await adminDb.collection('companies').doc(id).update(clean);
}

/** Borra la empresa y, en cascada, sus membresías y evaluaciones. */
export async function deleteCompany(id: string) {
  const [mems, evals] = await Promise.all([
    adminDb.collection('memberships').where('companyId', '==', id).get(),
    adminDb.collection('evaluations').where('companyId', '==', id).get(),
  ]);
  const batch = adminDb.batch();
  mems.docs.forEach((d) => batch.delete(d.ref));
  evals.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(adminDb.collection('companies').doc(id));
  await batch.commit();
}

// ─── Memberships ─────────────────────────────────────────────────────────────

/** ID compuesto para lookup O(1) sin índice */
export async function getMembership(uid: string, companyId: string): Promise<Membership | null> {
  const docId = `${uid}_${companyId}`;
  const docSnap = await adminDb.collection('memberships').doc(docId).get();
  if (docSnap.exists) {
    return { id: docSnap.id, ...docSnap.data() } as Membership;
  }
  // Si no hay membresía explícita, los administradores del sistema tienen acceso total como 'administrador'
  const sysRole = await getSystemRole(uid);
  if (sysRole === 'admin') {
    return {
      id: `virtual_admin_${uid}_${companyId}`,
      userId: uid,
      companyId: companyId,
      role: 'administrador',
    };
  }
  return null;
}

export async function createMembership(uid: string, companyId: string, role: Membership['role']) {
  const docId = `${uid}_${companyId}`;
  await adminDb.collection('memberships').doc(docId).set({
    userId: uid, companyId, role,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getMembersByCompany(companyId: string): Promise<Membership[]> {
  // Query simple — NO necesita índice compuesto
  const snap = await adminDb
    .collection('memberships')
    .where('companyId', '==', companyId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership));
}

export async function deleteMembership(uid: string, companyId: string) {
  await adminDb.collection('memberships').doc(`${uid}_${companyId}`).delete();
}

// ─── Users / permisos ────────────────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  systemRole?: string;
  isApproved?: boolean;
}

export async function getSystemRole(uid: string): Promise<string> {
  const snap = await adminDb.collection('users').doc(uid).get();
  return (snap.data()?.systemRole as string) || 'user';
}

/** Busca un usuario por email (exacto y, si no, en minúsculas). */
export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const raw = email.trim();
  for (const value of [raw, raw.toLowerCase()]) {
    const snap = await adminDb.collection('users').where('email', '==', value).limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0];
      return { uid: d.id, ...d.data() } as AppUser;
    }
  }
  return null;
}

/** Devuelve un mapa uid -> usuario para enriquecer listas de miembros. */
export async function getUsersByIds(ids: string[]): Promise<Record<string, AppUser>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  const map: Record<string, AppUser> = {};
  await Promise.all(
    unique.map(async (id) => {
      const snap = await adminDb.collection('users').doc(id).get();
      if (snap.exists) map[id] = { uid: id, ...snap.data() } as AppUser;
    }),
  );
  return map;
}

/** ¿Puede gestionar la empresa? admin global o administrador de la empresa. */
export async function canManageCompany(uid: string, companyId: string): Promise<boolean> {
  if ((await getSystemRole(uid)) === 'admin') return true;
  const m = await getMembership(uid, companyId);
  return m?.role === 'administrador';
}

// ─── Evaluations ─────────────────────────────────────────────────────────────

export async function createEvaluation(data: { companyId: string; createdBy: string }): Promise<string> {
  const ref = await adminDb.collection('evaluations').add({
    ...data,
    status: 'borrador',
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getEvaluationsByCompany(companyId: string): Promise<Evaluation[]> {
  // ✅ Solo .where() sin .orderBy() — evita requerir índice compuesto.
  // El ordenamiento se hace en JS con toMs().
  const snap = await adminDb
    .collection('evaluations')
    .where('companyId', '==', companyId)
    .get();

  const evals = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));

  // Ordenar más reciente primero en JavaScript
  return evals.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export async function getAllEvaluations(uid: string, systemRole?: string): Promise<Array<Evaluation & { companyName?: string }>> {
  const roleToUse = systemRole || (await getSystemRole(uid));
  const userCompanies = await getCompaniesByUser(uid, roleToUse);
  const companyMap = new Map(userCompanies.map(c => [c.id, c.name]));

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals = evalsSnap.docs
    .map((d) => {
      const data = d.data();
      return { id: d.id, ...data, companyName: companyMap.get(data.companyId) || 'Empresa' } as Evaluation & { companyName?: string };
    })
    .filter((e) => roleToUse === 'admin' || companyMap.has(e.companyId));

  return evals.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const docSnap = await adminDb.collection('evaluations').doc(id).get();
  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...docSnap.data() } as Evaluation;
}

export async function updateEvaluation(id: string, data: Partial<Omit<Evaluation, 'id'>>) {
  await adminDb.collection('evaluations').doc(id).update(data as FirebaseFirestore.UpdateData<Evaluation>);
}

// ─── Answers ─────────────────────────────────────────────────────────────────

export async function getAnswers(evaluationId: string): Promise<Record<number, boolean>> {
  const snap = await adminDb
    .collection('evaluations').doc(evaluationId)
    .collection('answers')
    .get();
  const map: Record<number, boolean> = {};
  snap.docs.forEach((d) => {
    const { questionId, value } = d.data();
    if (value !== null && value !== undefined) map[questionId] = value;
  });
  return map;
}

export async function upsertAnswers(
  evaluationId: string,
  answers: Record<number, boolean | null>,
) {
  const batch = adminDb.batch();
  for (const [qId, value] of Object.entries(answers)) {
    const ref = adminDb
      .collection('evaluations').doc(evaluationId)
      .collection('answers').doc(qId);
    batch.set(ref, { questionId: Number(qId), value }, { merge: true });
  }
  await batch.commit();
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export async function getRecommendations(evaluationId: string) {
  const snap = await adminDb
    .collection('evaluations').doc(evaluationId)
    .collection('recommendations')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertRecommendation(
  evaluationId: string,
  kind: string,
  content: unknown,
) {
  await adminDb
    .collection('evaluations').doc(evaluationId)
    .collection('recommendations').doc(kind)
    .set({ kind, content, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
