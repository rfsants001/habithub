import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // testes ficam ao lado do código (src/domain/grafo.test.ts)
    include: ['src/**/*.{test,spec}.ts'],

    // testes de rota falam com um SQLite em memória; o habithub.db nunca é tocado
    env: {
      DB_FILE: ':memory:',
      LOG_LEVEL: 'silent',
    },
    setupFiles: ['./src/test/setup.ts'],

    coverage: {
      provider: 'v8',
      // a TUI (scripts/) lê os dois JSON: 'json-summary' → tabela de %,
      // 'json' (coverage-final.json) → quais linhas ficaram descobertas
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test/**', // infra de teste, não é código de produção
        'src/db/migrations/**',
        'src/seed*.ts', // scripts de uso manual, não entram na conta
      ],
      // o domínio puro é o que precisa de cobertura de verdade (ADR-009)
      thresholds: {
        'src/domain/**': { statements: 90, branches: 85, functions: 100, lines: 90 },
      },
    },
  },
})
