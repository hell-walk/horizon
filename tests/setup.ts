// A fixed test key, so sealing works the same on every machine. Never a real key.
process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
