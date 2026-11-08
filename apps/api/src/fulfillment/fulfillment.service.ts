import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { OrderEntity } from '../database/entities/order.entity.js';
import { OrderItemEntity } from '../database/entities/order-item.entity.js';
import {
  VendorOrderEntity,
  VendorFulfillmentStatus as Status,
} from '../database/entities/vendor-order.entity.js';
import { ShipmentEventEntity } from '../database/entities/shipment-event.entity.js';

const transitions: Record<Status, Status[]> = {
  [Status.CONFIRMED]: [Status.PACKED, Status.CANCELLED],
  [Status.PACKED]: [Status.SHIPPED, Status.CANCELLED],
  [Status.SHIPPED]: [Status.DELIVERED],
  [Status.DELIVERED]: [],
  [Status.CANCELLED]: [],
};

@Injectable()
export class FulfillmentService {
  constructor(private readonly dataSource: DataSource) {}

  async createVendorOrders(
    manager: EntityManager,
    order: OrderEntity,
    items: OrderItemEntity[],
  ): Promise<void> {
    const vendorTotals = new Map<string, number>();

    for (const item of items) {
      vendorTotals.set(
        item.vendorId,
        (vendorTotals.get(item.vendorId) ?? 0) + item.lineTotal,
      );
    }

    for (const [vendorId, totalAmount] of vendorTotals) {
      const vendorOrder = await manager.save(
        VendorOrderEntity,
        manager.create(VendorOrderEntity, {
          orderId: order.id,
          vendorId,
          totalAmount,
          status: Status.CONFIRMED,
        }),
      );

      await manager.save(
        ShipmentEventEntity,
        manager.create(ShipmentEventEntity, {
          vendorOrderId: vendorOrder.id,
          fromStatus: null,
          toStatus: Status.CONFIRMED,
          actorId: 'SYSTEM',
          reason: 'Created during checkout',
        }),
      );
    }
  }

  async updateStatus(
    vendorOrderId: string,
    nextStatus: Status,
    actorId: string,
    actorVendorId: string | undefined,
    isAdmin: boolean,
    reason = '',
  ): Promise<VendorOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const vendorOrder = await manager
        .getRepository(VendorOrderEntity)
        .createQueryBuilder('vo')
        .setLock('pessimistic_write')
        .where('vo.id = :id', { id: vendorOrderId })
        .getOne();

      if (!vendorOrder) {
        throw new NotFoundException('Vendor fulfillment not found');
      }

      if (!isAdmin && vendorOrder.vendorId !== actorVendorId) {
        throw new ForbiddenException(
          'You cannot update another vendor fulfillment',
        );
      }

      const allowed = transitions[vendorOrder.status];

      if (!allowed.includes(nextStatus)) {
        throw new ConflictException(
          `Invalid fulfillment transition: ${vendorOrder.status} -> ${nextStatus}`,
        );
      }

      const previousStatus = vendorOrder.status;

      vendorOrder.status = nextStatus;

      await manager.save(VendorOrderEntity, vendorOrder);

      await manager.save(
        ShipmentEventEntity,
        manager.create(ShipmentEventEntity, {
          vendorOrderId,
          fromStatus: previousStatus,
          toStatus: nextStatus,
          actorId,
          reason: reason || `Transition to ${nextStatus}`,
        }),
      );

      return vendorOrder;
    });
  }

  async findForVendor(vendorId: string): Promise<VendorOrderEntity[]> {
    return this.dataSource.getRepository(VendorOrderEntity).find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
    });
  }

  async getHistory(
    vendorOrderId: string,
    actorVendorId: string | undefined,
    isAdmin: boolean,
  ): Promise<ShipmentEventEntity[]> {
    const vendorOrder = await this.dataSource
      .getRepository(VendorOrderEntity)
      .findOneBy({ id: vendorOrderId });

    if (!vendorOrder) {
      throw new NotFoundException('Vendor fulfillment not found');
    }

    if (!isAdmin && vendorOrder.vendorId !== actorVendorId) {
      throw new ForbiddenException('Access denied');
    }

    return this.dataSource.getRepository(ShipmentEventEntity).find({
      where: { vendorOrderId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async getOrderSummary(orderId: string, customerId: string) {
    const order = await this.dataSource.getRepository(OrderEntity).findOne({
      where: { id: orderId, customerId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const vendorOrders = await this.dataSource
      .getRepository(VendorOrderEntity)
      .find({
        where: { orderId },
        order: { vendorId: 'ASC' },
      });

    if (vendorOrders.length === 0) {
      return {
        orderId,
        fulfillmentStatus: 'NOT_STARTED',
        vendorOrders,
      };
    }

    const statuses = vendorOrders.map((vo) => vo.status);

    let fulfillmentStatus: string;

    if (statuses.every((s) => s === Status.DELIVERED)) {
      fulfillmentStatus = 'DELIVERED';
    } else if (statuses.every((s) => s === Status.CANCELLED)) {
      fulfillmentStatus = 'CANCELLED';
    } else if (statuses.some((s) => s === Status.DELIVERED)) {
      fulfillmentStatus = 'PARTIALLY_DELIVERED';
    } else if (statuses.some((s) => s === Status.SHIPPED)) {
      fulfillmentStatus = 'PARTIALLY_SHIPPED';
    } else if (statuses.every((s) => s === Status.CONFIRMED)) {
      fulfillmentStatus = 'CONFIRMED';
    } else {
      fulfillmentStatus = 'IN_PROGRESS';
    }

    return {
      orderId,
      fulfillmentStatus,
      vendorOrders,
    };
  }
}
