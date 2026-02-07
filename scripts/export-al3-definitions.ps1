$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

$cmd = $conn.CreateCommand()

# Export Groups
Write-Host "Exporting Groups..."
$cmd.CommandText = "SELECT AL3Group, GroupVersionNum, GroupName, GroupLength FROM Groups"
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$groups = New-Object System.Data.DataTable
$adapter.Fill($groups) | Out-Null

$groupsObj = @{}
foreach ($row in $groups.Rows) {
    $grp = if ($row["AL3Group"] -is [DBNull]) { "" } else { $row["AL3Group"].ToString().Trim() }
    if ($grp -and $grp.Length -eq 4) {
        $lenStr = if ($row["GroupLength"] -is [DBNull]) { "0" } else { $row["GroupLength"].ToString().Trim() }
        $len = 0
        [int]::TryParse($lenStr, [ref]$len) | Out-Null

        $groupsObj[$grp] = @{
            version = if ($row["GroupVersionNum"] -is [DBNull]) { "" } else { $row["GroupVersionNum"].ToString().Trim() }
            name = if ($row["GroupName"] -is [DBNull]) { "" } else { $row["GroupName"].ToString().Trim() }
            length = $len
        }
    }
}
$groupsJson = $groupsObj | ConvertTo-Json -Depth 3
$groupsJson | Out-File -FilePath "C:\Users\ToddConn\tcds-triage\src\lib\al3\definitions\groups.json" -Encoding UTF8

# Export DDE (field definitions)
Write-Host "Exporting DDE..."
$cmd.CommandText = "SELECT AL3Group, ReferenceID, Element, [Start], AL3Length, DataType, Class, Description FROM DDE"
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dde = New-Object System.Data.DataTable
$adapter.Fill($dde) | Out-Null

$ddeObj = @{}
foreach ($row in $dde.Rows) {
    $grp = if ($row["AL3Group"] -is [DBNull]) { "" } else { $row["AL3Group"].ToString().Trim() }
    if (-not $grp -or $grp.Length -ne 4) { continue }

    if (-not $ddeObj.ContainsKey($grp)) {
        $ddeObj[$grp] = @()
    }

    $startStr = if ($row["Start"] -is [DBNull]) { "0" } else { $row["Start"].ToString().Trim() }
    $lenStr = if ($row["AL3Length"] -is [DBNull]) { "0" } else { $row["AL3Length"].ToString().Trim() }
    $start = 0
    $len = 0
    [int]::TryParse($startStr, [ref]$start) | Out-Null
    [int]::TryParse($lenStr, [ref]$len) | Out-Null

    $desc = if ($row["Description"] -is [DBNull]) { "" } else { $row["Description"].ToString().Trim() }
    if ($desc.Length -gt 100) { $desc = $desc.Substring(0, 100) }

    $field = @{
        ref = if ($row["ReferenceID"] -is [DBNull]) { "" } else { $row["ReferenceID"].ToString().Trim() }
        element = if ($row["Element"] -is [DBNull]) { "" } else { $row["Element"].ToString().Trim() }
        start = $start
        length = $len
        dataType = if ($row["DataType"] -is [DBNull]) { "" } else { $row["DataType"].ToString().Trim() }
        class = if ($row["Class"] -is [DBNull]) { "" } else { $row["Class"].ToString().Trim() }
        desc = $desc
    }
    $ddeObj[$grp] += $field
}

# Sort fields by start position - need to use a different approach
$sortedDdeObj = @{}
foreach ($grp in @($ddeObj.Keys)) {
    $sortedDdeObj[$grp] = $ddeObj[$grp] | Sort-Object { [int]$_.start }
}

$ddeJson = $sortedDdeObj | ConvertTo-Json -Depth 4 -Compress
$ddeJson | Out-File -FilePath "C:\Users\ToddConn\tcds-triage\src\lib\al3\definitions\dde.json" -Encoding UTF8

# Export DDT (coded values)
Write-Host "Exporting DDT..."
$cmd.CommandText = "SELECT AL3ReferenceID, AL3CodeValue, AL3CodeDescription FROM DDT"
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$ddt = New-Object System.Data.DataTable
$adapter.Fill($ddt) | Out-Null

$ddtObj = @{}
foreach ($row in $ddt.Rows) {
    $ref = if ($row["AL3ReferenceID"] -is [DBNull]) { "" } else { $row["AL3ReferenceID"].ToString().Trim() }
    if (-not $ref) { continue }

    if (-not $ddtObj.ContainsKey($ref)) {
        $ddtObj[$ref] = @()
    }

    $code = @{
        value = if ($row["AL3CodeValue"] -is [DBNull]) { "" } else { $row["AL3CodeValue"].ToString().Trim() }
        desc = if ($row["AL3CodeDescription"] -is [DBNull]) { "" } else { $row["AL3CodeDescription"].ToString().Trim() }
    }
    $ddtObj[$ref] += $code
}

$ddtJson = $ddtObj | ConvertTo-Json -Depth 3 -Compress
$ddtJson | Out-File -FilePath "C:\Users\ToddConn\tcds-triage\src\lib\al3\definitions\ddt.json" -Encoding UTF8

$conn.Close()

Write-Host "Export complete!"
Write-Host "  Groups: $($groupsObj.Count) records"
Write-Host "  DDE: $($sortedDdeObj.Count) groups"
Write-Host "  DDT: $($ddtObj.Count) reference codes"
