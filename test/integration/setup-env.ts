process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgresql://skyops:skyops@localhost:5432/skyops_test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.PORT = '3001';
