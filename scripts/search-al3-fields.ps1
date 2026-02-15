$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

$cmd = $conn.CreateCommand()

# Get field definitions for 6CVA
Write-Host "=== 6CVA (Auto Coverage) Field Layout ==="
$cmd.CommandText = "SELECT ReferenceID, Element, Start, AL3Length, Description FROM DDE WHERE AL3Group = '6CVA' ORDER BY VAL(Start)"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $ref = $reader.GetValue(0).ToString()
    $elem = $reader.GetValue(1).ToString()
    $start = $reader.GetValue(2).ToString()
    $len = $reader.GetValue(3).ToString()
    $desc = $reader.GetValue(4).ToString()
    Write-Host $start.PadLeft(4) "-" $len.PadLeft(3) ": " $ref.PadRight(10) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

# Get field definitions for 6DIS (Driver Discount)
Write-Host ""
Write-Host "=== 6DIS (Driver Discount) Field Layout ==="
$cmd.CommandText = "SELECT ReferenceID, Element, Start, AL3Length, Description FROM DDE WHERE AL3Group = '6DIS' ORDER BY VAL(Start)"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $ref = $reader.GetValue(0).ToString()
    $elem = $reader.GetValue(1).ToString()
    $start = $reader.GetValue(2).ToString()
    $len = $reader.GetValue(3).ToString()
    $desc = $reader.GetValue(4).ToString()
    Write-Host $start.PadLeft(4) "-" $len.PadLeft(3) ": " $ref.PadRight(10) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

# Get field definitions for 5DSF (Discount-Surcharge Factor)
Write-Host ""
Write-Host "=== 5DSF (Discount-Surcharge Factor) Field Layout ==="
$cmd.CommandText = "SELECT ReferenceID, Element, Start, AL3Length, Description FROM DDE WHERE AL3Group = '5DSF' ORDER BY VAL(Start)"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $ref = $reader.GetValue(0).ToString()
    $elem = $reader.GetValue(1).ToString()
    $start = $reader.GetValue(2).ToString()
    $len = $reader.GetValue(3).ToString()
    $desc = $reader.GetValue(4).ToString()
    Write-Host $start.PadLeft(4) "-" $len.PadLeft(3) ": " $ref.PadRight(10) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

$conn.Close()
