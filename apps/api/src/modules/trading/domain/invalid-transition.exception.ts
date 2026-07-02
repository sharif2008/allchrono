import { BadRequestException } from '@nestjs/common';
import { TradeState } from '@prisma/client';

/**
 * Thrown by the Trade aggregate when a requested action is not legal from the
 * current state. Extends BadRequestException so Nest maps it to HTTP 400
 * automatically — the domain does not need to know about HTTP.
 */
export class InvalidTransitionException extends BadRequestException {
  constructor(from: TradeState, action: string, detail?: string) {
    super(
      detail ??
        `Action "${action}" is not allowed from state ${from}.`,
    );
  }
}
