"""Integration Tests for Operational CLI Commands."""

from click.testing import CliRunner

from app.cli import cli


def test_cli_check_config():
    """Verify check-config command exits cleanly."""
    runner = CliRunner()
    result = runner.invoke(cli, ["check-config"])
    assert result.exit_code == 0
    assert "Gridbricks Configuration Audit" in result.output
    assert "Configuration is valid." in result.output


def test_cli_data_quality_report():
    """Verify data-quality-report command executes."""
    runner = CliRunner()
    result = runner.invoke(
        cli, ["data-quality-report", "--decision-from", "2026-01-01", "--decision-to", "2026-01-02"]
    )
    assert result.exit_code == 0
    assert "Data Quality Report" in result.output
    assert "Snapshot Completeness Summary" in result.output
