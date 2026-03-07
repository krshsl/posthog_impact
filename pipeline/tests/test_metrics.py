"""
test_metrics.py — Unit tests for pipeline/metrics.py

All tests are pure (no I/O, no mocking) because metrics.py has no side effects.
"""
import pytest

from pipeline.metrics import (
    cycle_time_hours,
    is_off_hours,
    pr_size_label,
    time_in_review_hours,
    time_to_first_review_hours,
)


class TestIsOffHours:
    # -----------------------------------------------------------------------
    # Weekday within working hours → False
    # -----------------------------------------------------------------------

    def test_weekday_morning_is_on_hours(self):
        # 2024-01-08 is a Monday; 09:00 local is exactly the start of work hours
        assert is_off_hours("2024-01-08T09:00:00+00:00") is False

    def test_weekday_midday_is_on_hours(self):
        assert is_off_hours("2024-01-08T13:30:00+00:00") is False

    def test_weekday_last_valid_hour_is_on_hours(self):
        # 17:59 is still within hours
        assert is_off_hours("2024-01-08T17:59:00+00:00") is False

    # -----------------------------------------------------------------------
    # Weekday outside working hours → True
    # -----------------------------------------------------------------------

    def test_weekday_before_9am_is_off_hours(self):
        assert is_off_hours("2024-01-08T08:59:00+00:00") is True

    def test_weekday_at_18_is_off_hours(self):
        # 18:00 is the first off-hours minute
        assert is_off_hours("2024-01-08T18:00:00+00:00") is True

    def test_weekday_late_evening_is_off_hours(self):
        assert is_off_hours("2024-01-08T23:45:00+00:00") is True

    def test_weekday_midnight_is_off_hours(self):
        assert is_off_hours("2024-01-08T00:00:00+00:00") is True

    # -----------------------------------------------------------------------
    # Weekend → always True
    # -----------------------------------------------------------------------

    def test_saturday_working_hours_is_off_hours(self):
        # 2024-01-13 is a Saturday
        assert is_off_hours("2024-01-13T10:00:00+00:00") is True

    def test_sunday_working_hours_is_off_hours(self):
        # 2024-01-14 is a Sunday
        assert is_off_hours("2024-01-14T14:00:00+00:00") is True

    # -----------------------------------------------------------------------
    # Timezone correctness — local hour matters, not UTC
    # -----------------------------------------------------------------------

    def test_utc_looks_off_but_local_is_on_hours(self):
        # UTC 04:00 Mon + IST offset +05:30 → the hour stored in the datetime IS 04
        # (fromisoformat preserves the written hour as local time, not UTC)
        # 04:30 is before 9am → off hours
        assert is_off_hours("2024-01-08T04:30:00+05:30") is True

    def test_utc_looks_on_but_local_is_off_hours(self):
        # "2024-01-08T12:00:00-08:00" → the written hour 12 is the local time → on hours
        assert is_off_hours("2024-01-08T12:00:00-08:00") is False

    def test_positive_offset_weekend_boundary(self):
        # UTC Friday 23:00 + offset +02:00 → local Saturday 01:00 → weekend → off
        assert is_off_hours("2024-01-05T23:00:00+02:00") is True


class TestPRSizeLabel:
    def test_xs_boundary_zero(self):
        assert pr_size_label(0, 0) == "XS"

    def test_xs_boundary_49(self):
        assert pr_size_label(30, 19) == "XS"

    def test_s_at_50(self):
        assert pr_size_label(50, 0) == "S"

    def test_s_at_199(self):
        assert pr_size_label(100, 99) == "S"

    def test_m_at_200(self):
        assert pr_size_label(200, 0) == "M"

    def test_m_at_499(self):
        assert pr_size_label(300, 199) == "M"

    def test_l_at_500(self):
        assert pr_size_label(500, 0) == "L"

    def test_l_at_999(self):
        assert pr_size_label(600, 399) == "L"

    def test_xl_at_1000(self):
        assert pr_size_label(1000, 0) == "XL"

    def test_xl_large(self):
        assert pr_size_label(5000, 3000) == "XL"


class TestCycleTimeHours:
    def test_one_hour(self):
        assert cycle_time_hours(
            "2024-01-08T10:00:00+00:00",
            "2024-01-08T11:00:00+00:00",
        ) == pytest.approx(1.0)

    def test_24_hours(self):
        assert cycle_time_hours(
            "2024-01-08T00:00:00+00:00",
            "2024-01-09T00:00:00+00:00",
        ) == pytest.approx(24.0)

    def test_fractional_hours(self):
        result = cycle_time_hours(
            "2024-01-08T10:00:00+00:00",
            "2024-01-08T10:30:00+00:00",
        )
        assert result == pytest.approx(0.5)

    def test_cross_timezone(self):
        # Created at UTC+05:30, merged at UTC — should still give correct delta
        result = cycle_time_hours(
            "2024-01-08T08:00:00+05:30",
            "2024-01-08T05:30:00+00:00",
        )
        assert result == pytest.approx(3.0)

    def test_zero_delta(self):
        assert cycle_time_hours(
            "2024-01-08T10:00:00+00:00",
            "2024-01-08T10:00:00+00:00",
        ) == pytest.approx(0.0)


class TestTimeToFirstReviewHours:
    def test_no_review_returns_none(self):
        assert time_to_first_review_hours("2024-01-08T10:00:00+00:00", None) is None

    def test_two_hours_to_review(self):
        result = time_to_first_review_hours(
            "2024-01-08T10:00:00+00:00",
            "2024-01-08T12:00:00+00:00",
        )
        assert result == pytest.approx(2.0)


class TestTimeInReviewHours:
    def test_no_review_returns_none(self):
        assert time_in_review_hours(None, "2024-01-08T12:00:00+00:00") is None

    def test_four_hours_in_review(self):
        result = time_in_review_hours(
            "2024-01-08T10:00:00+00:00",
            "2024-01-08T14:00:00+00:00",
        )
        assert result == pytest.approx(4.0)
