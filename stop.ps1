[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$projectDirectory = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$projectPrefix = $projectDirectory + '\'

function Get-ServerListeners {
    @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq $Port } |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

try {
    $serverProcessIds = @(Get-ServerListeners)
    if ($serverProcessIds.Count -eq 0) {
        Write-Host "端口 $Port 没有运行中的服务，无需关闭。" -ForegroundColor Green
        exit 0
    }

    $refused = $false
    foreach ($serverProcessId in $serverProcessIds) {
        $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
        if (-not $serverProcess) { continue }

        $commandLine = ([string]$serverProcess.CommandLine).Replace('/', '\')
        $isProjectServer = $serverProcess.Name -ieq 'node.exe' -and
            $commandLine.IndexOf($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $commandLine -match '(?i)\\vite\\bin\\vite\.js(?:["\s]|$)'

        if (-not $isProjectServer) {
            Write-Host "端口 $Port 的进程 $serverProcessId 无法确认为本项目的 Vite 服务，未关闭。" -ForegroundColor Yellow
            Write-Host '请在对应的启动窗口按 Ctrl+C，或先核对占用端口的程序。'
            $refused = $true
            continue
        }

        # Recheck identity immediately before stopping to guard against PID reuse.
        $currentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
        if (-not $currentProcess) { continue }
        if ($currentProcess.CreationDate -ne $serverProcess.CreationDate -or
            $currentProcess.CommandLine -ne $serverProcess.CommandLine) {
            Write-Host "进程 $serverProcessId 已发生变化，未关闭。" -ForegroundColor Yellow
            $refused = $true
            continue
        }

        if ($PSCmdlet.ShouldProcess("Idea Collider，端口 $Port，进程 $serverProcessId", '停止本项目开发服务')) {
            Stop-Process -Id $serverProcessId -Force -ErrorAction Stop
            Write-Host "已关闭 Idea Collider 开发服务（端口 $Port）。" -ForegroundColor Green
        }
    }

    if ($WhatIfPreference) { exit 0 }
    if ($refused) { exit 2 }
    Start-Sleep -Milliseconds 200
    if (@(Get-ServerListeners).Count -gt 0) {
        Write-Host "端口 $Port 仍有程序监听，请核对后重试。" -ForegroundColor Yellow
        exit 2
    }
    Write-Host "端口 $Port 已释放，可以重新双击 start.cmd 启动。" -ForegroundColor Green
    exit 0
} catch {
    Write-Host ('关闭失败：' + $_.Exception.Message) -ForegroundColor Red
    Write-Host '如果没有权限，请在原启动窗口按 Ctrl+C。'
    exit 1
}
