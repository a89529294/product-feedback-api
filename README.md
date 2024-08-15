## Setting up TypeScript With Express

1. `pnpm i express`
2. `pnpm i -D typescript @types/express @types/node tsx`
3. `npx tsc --init`
4. open `tsconfig.json` and set `"outDir": "./dist"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
5. open `package.json` and set `"type": "module"`
6. open `package.json` and add to `"scripts"`

```js
{
    "dev": "tsx watch src/index.ts ",
    "build": "npx tsc",
    "start": "node dist/index.js"
}
```

## Setting up Drizzle generate and migrate

1. `npx drizzle-kit generate`
2. `npx drizzle-kit migrate`
