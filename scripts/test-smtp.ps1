param(
  [string]$To,
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env.production.local"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Missing environment file: $Path"
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $equalsIndex = $line.IndexOf("=")
    if ($equalsIndex -lt 1) { return }

    $name = $line.Substring(0, $equalsIndex).Trim()
    $value = $line.Substring($equalsIndex + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Import-DotEnv $EnvFile

if (-not $env:THEYEP_SMTP_PASS) {
  throw "THEYEP_SMTP_PASS is empty. Run scripts/configure-smtp.ps1 first."
}

if (-not $VerifyOnly -and -not $To) {
  throw "Provide -To someone@example.com or use -VerifyOnly."
}

$script = @'
import nodemailer from "nodemailer";

const verifyOnly = process.argv.includes("--verify-only");
const to = process.argv.find((arg) => arg.includes("@"));
const port = Number(process.env.THEYEP_SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.THEYEP_SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: {
    user: process.env.THEYEP_SMTP_USER,
    pass: process.env.THEYEP_SMTP_PASS,
  },
});

await transporter.verify();
if (verifyOnly) {
  console.log("SMTP verified.");
  process.exit(0);
}

await transporter.sendMail({
  from: `"TheYep" <${process.env.THEYEP_EMAIL_FROM || process.env.THEYEP_SMTP_USER}>`,
  to,
  subject: "TheYep SMTP test",
  text: "TheYep SMTP is working. Yep, it is alive.",
});

console.log(`SMTP test sent to ${to}.`);
'@

Push-Location $Root
try {
  $tempScript = Join-Path $Root ".theyep-smtp-test-$PID.mjs"
  Set-Content -LiteralPath $tempScript -Value $script -Encoding UTF8
  if ($VerifyOnly) {
    node $tempScript --verify-only
  } else {
    node $tempScript $To
  }
} finally {
  if ($tempScript -and (Test-Path $tempScript)) {
    Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
