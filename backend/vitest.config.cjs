const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
        },
        include: ['src/**/*.test.ts'],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});