"""Property-based tests for NIT validation (Property 4 from design).

**Validates: Requirements 3.3**

Property 4: For any string, the NIT validator SHALL accept it if and only if
it matches the pattern `^\\d{9,10}(-\\d)?$`.
"""

import re

from hypothesis import given, settings
from hypothesis import strategies as st

from src.modules.empresas.validators import NIT_PATTERN, validate_nit_format

# Reference regex for the property test (independent from the implementation)
REFERENCE_NIT_REGEX = re.compile(r"^\d{9,10}(-\d)?$")


# Strategy: generate strings that SHOULD match the NIT pattern
valid_nit_strategy = st.one_of(
    # 9 digits without verification digit
    st.from_regex(r"\A\d{9}\Z", fullmatch=True),
    # 10 digits without verification digit
    st.from_regex(r"\A\d{10}\Z", fullmatch=True),
    # 9 digits with verification digit
    st.from_regex(r"\A\d{9}-\d\Z", fullmatch=True),
    # 10 digits with verification digit
    st.from_regex(r"\A\d{10}-\d\Z", fullmatch=True),
)

# Strategy: generate arbitrary text strings for negative testing
arbitrary_text_strategy = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "S", "Z")),
    min_size=0,
    max_size=30,
)


class TestNITProperty:
    """Property-based tests for NIT format validation (Property 4)."""

    @given(nit=valid_nit_strategy)
    @settings(max_examples=100)
    def test_valid_nit_always_accepted(self, nit: str):
        """
        For any string matching ^\\d{9,10}(-\\d)?$, the validator SHALL accept it.

        **Validates: Requirements 3.3**
        """
        assert validate_nit_format(nit) is True
        # Double-check against reference regex
        assert REFERENCE_NIT_REGEX.match(nit) is not None

    @given(text=arbitrary_text_strategy)
    @settings(max_examples=100)
    def test_validator_agrees_with_regex(self, text: str):
        """
        For any string, the NIT validator SHALL accept it if and only if
        it matches the pattern ^\\d{9,10}(-\\d)?$.

        **Validates: Requirements 3.3**
        """
        expected = bool(REFERENCE_NIT_REGEX.match(text))
        actual = validate_nit_format(text)
        assert actual == expected, (
            f"Mismatch for input '{text}': validator={actual}, regex={expected}"
        )
