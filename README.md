# karai cli

WIP typescript karai cli program. 
- scans for new pointers
- stores pointers in sqlite db
- provides an HTTP API for pointer information

## setup

```
git clone https://github.com/turtlecoin/karai-cli-typescript
cd karai-cli-typescript
yarn
```

You need the following in the .env file at ther root of the project:

```
DAEMON_URI=http://yourdaemonhere.com:11898
API_PORT=16009
```

```
yarn start
```
