export interface IVisitor {
  id: string;
  tenantId: string;
  visitorName: string;
  visitorPhone: string;
  name?: string;
  phone?: string;
  purpose: string;
  expectedArrival: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: 'expected' | 'arrived' | 'departed' | 'cancelled';
  approvedBy?: string;
  createdAt: string;
}

export interface IVisitorRegister {
  tenantId?: string;
  visitorName: string;
  visitorPhone: string;
  name?: string;
  phone?: string;
  purpose: string;
  expectedArrival: string;
}

