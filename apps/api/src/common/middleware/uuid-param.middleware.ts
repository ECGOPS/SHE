import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_PARAMS = ['id', 'attachmentId', 'findingId', 'employeeId', 'attendanceId'];

@Injectable()
export class UuidParamMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const errors = ID_PARAMS.flatMap((field) => {
      const raw = req.params[field];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value === undefined || UUID.test(value)) return [];
      return [{ field, message: `${field} must be a valid id` }];
    });
    if (!errors.length) {
      next();
      return;
    }
    res.status(400).json({
      success: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are not valid.',
      errors,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
