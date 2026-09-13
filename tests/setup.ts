process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-characters";
process.env.LIVEKIT_API_KEY ??= "devkey";
process.env.LIVEKIT_API_SECRET ??= "devsecret_that_is_long_enough_for_jwt_hs256";
process.env.NEXT_PUBLIC_LIVEKIT_URL ??= "wss://test.livekit.cloud";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.ABLY_API_KEY ??= "testapp.deadbeef:testsecret";
