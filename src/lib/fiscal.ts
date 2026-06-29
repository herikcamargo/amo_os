import type { DeviceSale, FiscalDocument } from '@/types/database'

export interface FiscalProvider {
  requestDocument(sale: DeviceSale): Promise<FiscalDocument>
  cancelDocument(sale: DeviceSale, reason: string): Promise<FiscalDocument>
}

export class FiscalService {
  private provider?: FiscalProvider

  constructor(provider?: FiscalProvider) {
    this.provider = provider
  }

  async requestDocument(sale: DeviceSale) {
    if (!this.provider) throw new Error('Nenhum provedor fiscal configurado')
    return this.provider.requestDocument(sale)
  }

  async cancelDocument(sale: DeviceSale, reason: string) {
    if (!this.provider) throw new Error('Nenhum provedor fiscal configurado')
    return this.provider.cancelDocument(sale, reason)
  }
}

export const defaultFiscalDocument: FiscalDocument = {
  status: 'nao_solicitado',
}
