import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enviazo API',
      version: '1.0.0',
      description: `
# Enviazo - Logistics Marketplace API

Uber-like marketplace for deliveries. Connect package senders with vehicle owners.

## Authentication
All protected routes require a Bearer token in the Authorization header.

## Rate Limits
- General API: 100 requests per 15 minutes
- Auth endpoints: 20 requests per 15 minutes
      `,
      contact: {
        name: 'Enviazo Support',
        email: 'support@enviazo.cl',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.enviazo.cl', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['client', 'provider', 'admin'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Shipment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'accepted', 'in_transit', 'delivered', 'cancelled'] },
            origin_address: { type: 'string' },
            dest_address: { type: 'string' },
            total_price: { type: 'integer', description: 'Price in CLP' },
            distance_km: { type: 'number' },
            urgency: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'integer' },
            method: { type: 'string', enum: ['stripe', 'webpay', 'cash'] },
            status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
          },
        },
        TrackingState: {
          type: 'object',
          properties: {
            shipmentId: { type: 'string' },
            status: { type: 'string' },
            currentLocation: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' },
                speed: { type: 'number' },
                heading: { type: 'number' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            estimatedArrival: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Enviazo API Docs',
  }));

  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 API docs: http://localhost:3000/api-docs');
}
