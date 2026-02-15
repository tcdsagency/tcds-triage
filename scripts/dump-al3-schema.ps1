$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

$cmd = $conn.CreateCommand()

# Get Groups table structure
Write-Host "=== Groups Table ==="
$cmd.CommandText = "SELECT TOP 5 * FROM Groups"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
Write-Host "Columns:"
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
Write-Host ""
Write-Host "Sample data:"
while ($reader.Read()) {
    $row = ""
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $val = $reader.GetValue($i).ToString()
        if ($val.Length -gt 30) { $val = $val.Substring(0, 30) }
        $row += $val.PadRight(32) + "|"
    }
    Write-Host $row
}
$reader.Close()

# Get DDE table structure
Write-Host ""
Write-Host "=== DDE Table ==="
$cmd.CommandText = "SELECT TOP 1 * FROM DDE"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
Write-Host "Columns:"
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Get DDE for 5BIS (insured name)
Write-Host ""
Write-Host "=== DDE for 5BIS (Basic Insured Segment) ==="
$cmd.CommandText = "SELECT ReferenceID, Element, Start, AL3Length, DataType, Required, Description FROM DDE WHERE AL3Group = '5BIS' ORDER BY VAL(Start)"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $ref = $reader.GetValue(0).ToString().PadRight(12)
    $elem = $reader.GetValue(1).ToString().PadRight(5)
    $start = $reader.GetValue(2).ToString().PadLeft(4)
    $len = $reader.GetValue(3).ToString().PadLeft(3)
    $dtype = $reader.GetValue(4).ToString().PadRight(15)
    $req = $reader.GetValue(5).ToString().PadRight(3)
    $desc = $reader.GetValue(6).ToString()
    if ($desc.Length -gt 40) { $desc = $desc.Substring(0, 40) }
    Write-Host "$start $len : $ref $dtype [$req] $desc"
}
$reader.Close()

# Get CodesAL3 sample
Write-Host ""
Write-Host "=== CodesAL3 Table ==="
$cmd.CommandText = "SELECT TOP 1 * FROM CodesAL3"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
Write-Host "Columns:"
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Sample coded values for coverage types
Write-Host ""
Write-Host "=== Sample CodesAL3 (Coverage Types) ==="
$cmd.CommandText = "SELECT TOP 20 * FROM CodesAL3 WHERE ReferenceID LIKE '%COV%' OR ReferenceID LIKE '%LOSS%'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $ref = $reader.GetValue(0).ToString().PadRight(20)
    $code = $reader.GetValue(1).ToString().PadRight(10)
    $desc = $reader.GetValue(2).ToString()
    if ($desc.Length -gt 40) { $desc = $desc.Substring(0, 40) }
    Write-Host "$ref $code : $desc"
}
$reader.Close()

# Get DDT sample
Write-Host ""
Write-Host "=== DDT Table ==="
$cmd.CommandText = "SELECT TOP 1 * FROM DDT"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
Write-Host "Columns:"
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Get count of records per group
Write-Host ""
Write-Host "=== Record Counts by Group ==="
$cmd.CommandText = "SELECT AL3Group, COUNT(*) as FieldCount FROM DDE GROUP BY AL3Group ORDER BY AL3Group"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $grp = $reader.GetValue(0).ToString().PadRight(6)
    $cnt = $reader.GetValue(1).ToString()
    Write-Host "$grp : $cnt fields"
}
$reader.Close()

$conn.Close()
