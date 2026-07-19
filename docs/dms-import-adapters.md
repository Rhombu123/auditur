# DMS import adapter contract

Auditur's manual import pipeline is DMS-neutral:

1. Detect the file as PDF or UTF-8 CSV.
2. Parse it through a format adapter into `ParseResult`.
3. Normalize and deduplicate vehicles by six-character VIN suffix.
4. Reject an empty result before persistence.
5. Store the source file and activate the upload atomically.

An adapter returns canonical inventory items plus provenance:

- `items`: VIN/full VIN, stock number, year, make, model, color, source status,
  days on lot, and mileage when available.
- `detectedSource`: a lowercase source identifier, or `unknown`.
- `detectedColumns`: canonical fields found in the source.
- `parserName` and `parserVersion`: stable parser identifiers.
- `warnings`: row-level omissions, invalid values, and duplicate handling.
- `rawTextPreview` and `totalLines`: bounded diagnostics for failed imports.

Adapters must not write to Supabase or activate uploads. Persistence remains in
the shared upload pipeline so storage, dealership scoping, validation, and
activation behavior are identical for every source.

## Adding a source

Add a parser only after obtaining a representative export fixture with
permission to use it in tests. Cover full and partial VINs, quoted fields,
alternate headers, missing values, malformed rows, duplicate suffixes, and
source statuses. A parser may identify a DMS only from reliable file evidence;
otherwise it must report `unknown`.

Future SFTP, secure-email, and official API integrations should produce the same
adapter result and call the shared activation path. They should add a new
`ImportMethod` only with a corresponding database constraint migration,
authentication model, replay/idempotency policy, and source fixture coverage.

Do not advertise a DMS as supported until a real export fixture passes the
adapter tests. PDF imports retain highlighted-export support; CSV and other
non-PDF imports must reject highlighted-PDF export clearly.
