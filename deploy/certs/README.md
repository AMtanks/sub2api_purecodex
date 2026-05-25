# Cloudflare Origin CA Files

Put your Cloudflare Origin CA certificate and private key here before rerunning
`deploy/remote-first-run.sh`.

Expected filenames:

- `cloudflare-origin.crt`
- `cloudflare-origin.key`

These files should never be committed. This directory keeps only the filename
convention in git.
