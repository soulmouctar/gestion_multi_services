import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ApiResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private readonly API_URL = 'http://localhost:8000/api';
  
  constructor(private http: HttpClient) {}
  
  // Generate PDF from API
  generatePdfFromApi(endpoint: string, data: any): Observable<Blob> {
    return this.http.post(`${this.API_URL}/${endpoint}`, data, {
      responseType: 'blob'
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  // Generate invoice PDF
  generateInvoicePdf(invoiceData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/invoice', invoiceData);
  }
  
  // Generate receipt PDF
  generateReceiptPdf(receiptData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/receipt', receiptData);
  }
  
  // Generate contract PDF
  generateContractPdf(contractData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/contract', contractData);
  }
  
  // Generate report PDF
  generateReportPdf(reportData: { type: string; filters: any }): Observable<Blob> {
    return this.generatePdfFromApi('pdf/report', reportData);
  }
  
  // Client-side PDF generation using pdf-lib
  
  // Generate simple receipt
  async generateSimpleReceipt(data: {
    title: string;
    receiptNumber: string;
    date: Date;
    amount: number;
    currency: string;
    paymentMethod: string;
    clientName?: string;
    description?: string;
  }): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Title
    page.drawText(data.title, {
      x: 300,
      y: 350,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // Receipt info
    let yPosition = 320;
    const receiptInfo = [
      `Receipt No: ${data.receiptNumber}`,
      `Date: ${data.date.toLocaleDateString()}`,
      `Payment Method: ${data.paymentMethod}`
    ];
    
    if (data.clientName) {
      receiptInfo.push(`Client: ${data.clientName}`);
    }
    
    receiptInfo.forEach(text => {
      page.drawText(text, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    });
    
    // Amount
    yPosition -= 20;
    page.drawText(`Amount: ${data.amount.toFixed(2)} ${data.currency}`, {
      x: 50,
      y: yPosition,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    if (data.description) {
      yPosition -= 30;
      page.drawText(`Description: ${data.description}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    }
    
    // Save
    const pdfBytes = await pdfDoc.save();
    this.downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `receipt-${data.receiptNumber}.pdf`);
  }
  
  // Generate invoice
  async generateInvoice(invoiceData: {
    invoiceNumber: string;
    date: Date;
    dueDate: Date;
    clientName: string;
    clientAddress?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax?: number;
    total: number;
    currency: string;
  }): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = 750;
    
    // Header
    page.drawText('INVOICE', {
      x: 300,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;
    
    // Invoice info
    const invoiceInfo = [
      `Invoice Number: ${invoiceData.invoiceNumber}`,
      `Date: ${invoiceData.date.toLocaleDateString()}`,
      `Due Date: ${invoiceData.dueDate.toLocaleDateString()}`
    ];
    
    invoiceInfo.forEach(text => {
      page.drawText(text, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    });
    
    // Client info
    page.drawText(`Bill To: ${invoiceData.clientName}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    
    if (invoiceData.clientAddress) {
      page.drawText(invoiceData.clientAddress, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }
    yPosition -= 15;
    
    // Table headers
    page.drawText('Description', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText('Qty', {
      x: 250,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText('Price', {
      x: 300,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText('Total', {
      x: 400,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    
    // Line
    this.drawLine(page, 50, yPosition, 500, yPosition);
    yPosition -= 20;
    
    // Items
    invoiceData.items.forEach(item => {
      page.drawText(item.description, {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      page.drawText(item.quantity.toString(), {
        x: 250,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`${item.unitPrice.toFixed(2)} ${invoiceData.currency}`, {
        x: 300,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      page.drawText(`${item.total.toFixed(2)} ${invoiceData.currency}`, {
        x: 400,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    });
    
    // Line
    this.drawLine(page, 50, yPosition, 500, yPosition);
    yPosition -= 20;
    
    // Totals
    page.drawText(`Subtotal: ${invoiceData.subtotal.toFixed(2)} ${invoiceData.currency}`, {
      x: 350,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    
    if (invoiceData.tax) {
      page.drawText(`Tax: ${invoiceData.tax.toFixed(2)} ${invoiceData.currency}`, {
        x: 350,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }
    
    page.drawText(`Total: ${invoiceData.total.toFixed(2)} ${invoiceData.currency}`, {
      x: 350,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // Save
    const pdfBytes = await pdfDoc.save();
    this.downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `invoice-${invoiceData.invoiceNumber}.pdf`);
  }
  
  // Generate rental contract
  async generateRentalContract(contractData: {
    contractNumber: string;
    propertyName: string;
    tenantName: string;
    landlordName: string;
    startDate: Date;
    endDate?: Date;
    rentAmount: number;
    currency: string;
    paymentFrequency: string;
    terms?: string;
  }): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = 750;
    
    // Title
    page.drawText('RENTAL CONTRACT', {
      x: 300,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 40;
    
    // Contract info
    const contractInfo = [
      `Contract Number: ${contractData.contractNumber}`,
      `Property: ${contractData.propertyName}`,
      `Landlord: ${contractData.landlordName}`,
      `Tenant: ${contractData.tenantName}`,
      `Start Date: ${contractData.startDate.toLocaleDateString()}`
    ];
    
    if (contractData.endDate) {
      contractInfo.push(`End Date: ${contractData.endDate.toLocaleDateString()}`);
    }
    
    contractInfo.push(`Rent Amount: ${contractData.rentAmount.toFixed(2)} ${contractData.currency}`);
    contractInfo.push(`Payment Frequency: ${contractData.paymentFrequency}`);
    
    contractInfo.forEach(text => {
      page.drawText(text, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    });
    
    yPosition -= 20;
    
    // Terms
    if (contractData.terms) {
      page.drawText('Terms and Conditions:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;
      
      // Word wrap for terms
      const maxLineWidth = 500;
      const words = contractData.terms.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = await this.getTextWidth(testLine, font, 10);
        
        if (textWidth > maxLineWidth && currentLine) {
          page.drawText(currentLine, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          });
          currentLine = word;
          yPosition -= 15;
          
          if (yPosition < 100) {
            pdfDoc.addPage();
            yPosition = 750;
          }
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, {
          x: 50,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
    }
    
    // Signature lines
    yPosition -= 50;
    page.drawText('Landlord Signature: ____________________', {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;
    page.drawText('Tenant Signature: ____________________', {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Save
    const pdfBytes = await pdfDoc.save();
    this.downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `contract-${contractData.contractNumber}.pdf`);
  }
  
  // Generate financial report
  async generateFinancialReport(reportData: {
    title: string;
    period: string;
    date: Date;
    sections: Array<{
      title: string;
      data: Array<{ label: string; value: string }>;
    }>;
  }): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = 750;
    
    // Title
    page.drawText(reportData.title, {
      x: 300,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 25;
    
    // Period and date
    page.drawText(`Period: ${reportData.period}`, {
      x: 300,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    page.drawText(`Generated: ${reportData.date.toLocaleDateString()}`, {
      x: 300,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;
    
    // Sections
    reportData.sections.forEach(section => {
      if (yPosition < 100) {
        pdfDoc.addPage();
        yPosition = 750;
      }
      
      // Section title
      page.drawText(section.title, {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
      
      // Section data
      section.data.forEach(item => {
        page.drawText(`${item.label}: ${item.value}`, {
          x: 70,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
      });
      
      yPosition -= 10;
    });
    
    // Save
    const pdfBytes = await pdfDoc.save();
    this.downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${reportData.date.getTime()}.pdf`);
  }
  
  // Download blob as file
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
  
  // Helper methods for pdf-lib
  private drawLine(page: any, x1: number, y1: number, x2: number, y2: number): void {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }
  
  private async getTextWidth(text: string, font: any, fontSize: number): Promise<number> {
    // Approximate text width calculation for pdf-lib
    // This is a rough estimate - for precise measurement, you might need a more complex solution
    const avgCharWidth = fontSize * 0.6; // Approximate average character width
    return text.length * avgCharWidth;
  }
  
  // Private error handling
  private handleError(error: any): Observable<never> {
    let errorMessage = 'PDF service error';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
