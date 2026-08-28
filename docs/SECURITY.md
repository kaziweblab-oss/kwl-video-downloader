# Security

## Baseline architecture

- No arbitrary shell execution from the frontend.
- All native process execution remains in Tauri/Rust.
- Input validation is enforced before command creation.
- Temporary directories will be isolated and cleaned up in later phases.
- Process timeouts and crash handling are planned for the native layer.
- HTTPS will be required for all server communication.
- Secrets must never be embedded in the desktop binary or frontend bundle.
- Update and license verification must use cryptographic validation.

## Phase 1 security rules enforced

- frontend does not directly execute commands
- native validation commands exist in the Rust layer
- URL validation checks `http` and `https`
- output path validation rejects dangerous traversal patterns
- no production credentials or tokens are present in the repository

## Additional requirements for future phases

- No PATH-based runtime resolution in production mode.
- Safe filename generation must be implemented.
- User-supplied URLs must be validated before analysis or download.
- Signed release artifacts must be preferred for update installation.
