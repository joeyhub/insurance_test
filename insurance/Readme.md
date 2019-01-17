## Quick Start...

```
# Edit as needed after copy for credentials.
cp .env.local{.dist,}
# Will install dev deps (server needed below)!
composer install
bin/console doctrine:database:create
bin/console doctrine:schema:create
bin/console server:run
```

http://localhost:8000/quote
