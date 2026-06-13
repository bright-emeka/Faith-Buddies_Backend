# TODO

- [x] Implement `GET /api/users/search?query=` in `routes/users.js` (regex on `name`, case-insensitive)
- [x] Implement `POST /api/follows/follow/:uid` in `routes/follows.js` (strict follow; validate no self-follow; increment counts)

- [ ] Ensure existing follow routes still work (keep toggle endpoint as-is unless conflicts)
- [ ] If `server.js` mounts differ from `/api/users` and `/api/follows`, update accordingly
- [ ] Manual verification with curl/Postman:
  - [ ] `GET /api/users/search?query=...`
  - [ ] `POST /api/follows/follow/:uid` (authenticated)

