"""Integration tests for the diagnostic scoring API endpoints.

Tests POST /api/v1/diagnostico/score and POST /api/v1/diagnostico/simulate.
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


class TestScoreEndpoint:
    """Tests for POST /api/v1/diagnostico/score."""

    def test_score_all_true(self):
        """All answers True should return score 100."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {str(i): True for i in range(1, 12)}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 100
        assert data["maturity"]["label"] == "Líder"
        assert data["gaps"] == []

    def test_score_all_false(self):
        """All answers False should return score 0."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {str(i): False for i in range(1, 12)}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 0
        assert data["maturity"]["label"] == "Inicial"

    def test_score_partial(self):
        """Partial answers with known expected score."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {
                "1": True, "2": True, "3": True, "4": True, "5": True,
                "6": True, "7": True, "8": True, "9": False, "10": False, "11": False,
            }},
        )
        assert response.status_code == 200
        data = response.json()
        # Q2-Q5=True (40) + Q6-Q8=True (36) + Q9,Q10=False (0) = 76
        assert data["score"] == 76
        assert data["maturity"]["label"] == "Optimizado"

    def test_score_response_structure(self):
        """Verify response has all required fields."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {"1": True, "6": True, "9": True, "10": True, "11": True}},
        )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "maturity" in data
        assert "blocks" in data
        assert "gaps" in data
        assert "notes" in data
        assert "A" in data["blocks"]
        assert "B" in data["blocks"]
        assert "C" in data["blocks"]
        assert "label" in data["maturity"]
        assert "color" in data["maturity"]
        assert "bg_color" in data["maturity"]

    def test_score_invalid_question_id(self):
        """Question ID out of range should return 422."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {"99": True}},
        )
        assert response.status_code == 422

    def test_score_empty_answers(self):
        """Empty answers dict should be accepted (all default to False)."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 0

    def test_score_gating_reflected_in_response(self):
        """Q1=False should gate Q2-Q5 even if they're True."""
        response = client.post(
            "/api/v1/diagnostico/score",
            json={"answers": {
                "1": False, "2": True, "3": True, "4": True, "5": True,
                "6": False, "7": False, "8": False, "9": False, "10": False, "11": False,
            }},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 0
        assert data["blocks"]["A"]["earned"] == 0


class TestSimulateEndpoint:
    """Tests for POST /api/v1/diagnostico/simulate."""

    def test_simulate_basic(self):
        """Simulate improving Q9 from False baseline."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {str(i): False for i in range(1, 12)},
                "improvements": [9],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projected"]["score"] == 16
        assert data["delta"] == 16

    def test_simulate_multiple_improvements(self):
        """Simulate multiple improvements at once."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {str(i): False for i in range(1, 12)},
                "improvements": [6, 7, 8],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projected"]["score"] == 36
        assert data["delta"] == 36

    def test_simulate_invalid_improvement_q1(self):
        """Q1 cannot be improved (not a scored question) → 422."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {str(i): False for i in range(1, 12)},
                "improvements": [1],
            },
        )
        assert response.status_code == 422

    def test_simulate_invalid_improvement_q11(self):
        """Q11 cannot be improved (not a scored question) → 422."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {str(i): False for i in range(1, 12)},
                "improvements": [11],
            },
        )
        assert response.status_code == 422

    def test_simulate_empty_improvements(self):
        """Empty improvements list → 422 (min_length=1)."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {str(i): False for i in range(1, 12)},
                "improvements": [],
            },
        )
        assert response.status_code == 422

    def test_simulate_response_structure(self):
        """Verify response has projected and delta."""
        response = client.post(
            "/api/v1/diagnostico/simulate",
            json={
                "current_answers": {"1": True, "2": False, "3": False, "4": False,
                                    "5": False, "6": True, "7": False, "8": False,
                                    "9": False, "10": False, "11": False},
                "improvements": [9],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "projected" in data
        assert "delta" in data
        assert "score" in data["projected"]
        assert "maturity" in data["projected"]
        assert "blocks" in data["projected"]
        assert "gaps" in data["projected"]
        assert "notes" in data["projected"]
