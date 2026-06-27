import Link from 'next/link';
import { Shield, Clock } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 bg-grid-pattern p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-amber-100">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cuenta en revisión</h1>
        
        <p className="text-slate-600 leading-relaxed text-sm">
          Tu cuenta ha sido creada exitosamente, pero está pendiente de aprobación por parte de un administrador. 
          Recibirás acceso una vez que tu cuenta sea validada y se te asigne un rol.
        </p>
        
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-500">
          Si crees que esto es un error, por favor contacta a soporte o al administrador de la plataforma.
        </div>

        <div className="pt-4 border-t border-slate-100">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
