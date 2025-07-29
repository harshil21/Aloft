# Aloft


Aloft is a simple static web application which retrieves multi-level wind data from the [Open-Meteo API](https://open-meteo.com/en/docs)
for use in OpenRocket's multi-level wind profile feature (v24.12 and later). The data can be
downloaded and imported into OpenRocket as a csv file.

## Local setup and usage:

This repository uses [Bun](https://bun.com) as the TypeScript runtime and package manager.


To install dependencies:

```bash
bun install
```

To build the project:

```bash
bun run build
```

To run the project and serve locally:

```bash
bun run serve
```

## LICENSE
This project is licensed under the [MIT License](LICENSE).