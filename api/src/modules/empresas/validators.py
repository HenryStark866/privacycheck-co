"""NIT format validation for Colombian companies."""

import re

# Colombian NIT: 9-10 numeric digits with optional verification digit separated by hyphen
NIT_PATTERN = re.compile(r"^\d{9,10}(-\d)?$")


def validate_nit_format(nit: str) -> bool:
    """
    Validate that a NIT string matches the Colombian format.

    Colombian NIT format: 9 or 10 numeric digits optionally followed
    by a hyphen and one verification digit.

    Regex: ^\\d{9,10}(-\\d)?$

    Args:
        nit: The NIT string to validate.

    Returns:
        True if the NIT matches the required format, False otherwise.
    """
    return bool(NIT_PATTERN.match(nit))
