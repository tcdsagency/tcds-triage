$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# Search for discount codes
Write-Host "=== DISCOUNT CODES ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT AL3ReferenceID, AL3CodeValue, AL3CodeDescription FROM CodesAL3 WHERE AL3CodeDescription LIKE '%discount%' OR AL3ReferenceID LIKE '%DISC%'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host $reader.GetValue(0).ToString().PadRight(10) $reader.GetValue(1).ToString().PadRight(10) $reader.GetValue(2).ToString()
}
$reader.Close()

# Search for coverage codes (ACVCD or similar)
Write-Host ""
Write-Host "=== COVERAGE CODE LISTS ==="
$cmd.CommandText = "SELECT AL3ReferenceID, AL3CodeValue, AL3CodeDescription FROM CodesAL3 WHERE AL3ReferenceID IN ('ACVCD', 'HCVCD', 'WCVCD', 'PCVCD') AND AL3IsAList = False"
$reader = $cmd.ExecuteReader()
$count = 0
while ($reader.Read() -and $count -lt 50) {
    Write-Host $reader.GetValue(0).ToString().PadRight(10) $reader.GetValue(1).ToString().PadRight(10) $reader.GetValue(2).ToString()
    $count++
}
$reader.Close()

# Search for specific discount codes we're seeing
Write-Host ""
Write-Host "=== SPECIFIC CODES (AFR, HON, MC1, SMP, etc.) ==="
$cmd.CommandText = "SELECT AL3ReferenceID, AL3CodeValue, AL3CodeDescription FROM CodesAL3 WHERE AL3CodeValue IN ('AFR', 'HON', 'MC1', 'SMP', 'IPP', 'SD3', 'NP3', 'NP5', 'CFR', 'PPAYD', 'DAS', 'ASC', 'PIF', 'DPP')"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host $reader.GetValue(0).ToString().PadRight(10) $reader.GetValue(1).ToString().PadRight(10) $reader.GetValue(2).ToString()
}
$reader.Close()

$conn.Close()
