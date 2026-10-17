# Included in every location: an add_header inside a location drops the server-level ones.
add_header Permissions-Policy "camera=(self), geolocation=(self), microphone=()" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
