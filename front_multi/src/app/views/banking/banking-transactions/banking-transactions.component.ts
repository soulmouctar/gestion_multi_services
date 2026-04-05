import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, SpinnerModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-banking-transactions',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule, ModalModule, SpinnerModule, ProgressModule
  ],
  templateUrl: './banking-transactions.component.html'
})
export class BankingTransactionsComponent implements OnInit {

  transactions: any[]   = [];
  accounts: any[]       = [];
  loading               = false;
  uploading             = false;
  showModal             = false;
  showProofModal        = false;
  editMode              = false;
  submitted             = false;
  selectedTx: any       = null;
  proofViewUrl          = '';
  proofViewType         = '';
  proofFile: File | null = null;
  proofPreview          = '';
  proofSizeInfo         = '';
  totalItems            = 0;
  currentPage           = 1;
  perPage               = 20;

  filters = {
    account_id:       '',
    transaction_type: '',
    status:           '',
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to:   new Date().toISOString().split('T')[0],
    search:    ''
  };

  form: FormGroup;

  txTypes = [
    { value: 'DEPOT',            label: 'Dépôt',             color: 'success', icon: 'cilArrowBottom' },
    { value: 'RETRAIT',          label: 'Retrait',           color: 'danger',  icon: 'cilArrowTop'    },
    { value: 'REMISE_CHEQUE',    label: 'Remise de chèque',  color: 'info',    icon: 'cilNotes'       },
    { value: 'VIREMENT_ENTRANT', label: 'Virement entrant',  color: 'primary', icon: 'cilArrowBottom' },
    { value: 'VIREMENT_SORTANT', label: 'Virement sortant',  color: 'warning', icon: 'cilArrowTop'    },
  ];

  proofTypes = [
    { value: 'BORDEREAU', label: 'Bordereau de versement' },
    { value: 'CHEQUE',    label: 'Chèque' },
    { value: 'RECU',      label: 'Reçu' },
    { value: 'AUTRE',     label: 'Autre' },
  ];

  statuses = [
    { value: 'COMPLETED', label: 'Complété',   color: 'success'   },
    { value: 'PENDING',   label: 'En attente', color: 'warning'   },
    { value: 'CANCELLED', label: 'Annulé',     color: 'secondary' },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      bank_account_id:  ['', Validators.required],
      transaction_type: ['DEPOT', Validators.required],
      amount:           [null, [Validators.required, Validators.min(0.01)]],
      currency:         ['GNF', Validators.required],
      transaction_date: [new Date().toISOString().split('T')[0], Validators.required],
      reference:        [''],
      description:      [''],
      proof_type:       [null],
      status:           ['COMPLETED']
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['account_id']) this.filters.account_id = p['account_id'];
      this.loadAccounts();
      this.loadTransactions();
    });
  }

  loadAccounts(): void {
    this.apiService.get<any>('banking/accounts').subscribe({
      next: (r) => { this.accounts = r.success ? (r.data || []) : []; }
    });
  }

  loadTransactions(): void {
    this.loading = true;
    const params: any = { page: this.currentPage, per_page: this.perPage, ...this.filters };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });

    this.apiService.get<any>('banking/transactions', { params }).subscribe({
      next: (r) => {
        if (r.success) {
          const d         = r.data;
          this.transactions = d.data || d || [];
          this.totalItems   = d.total || this.transactions.length;
        } else {
          this.transactions = [];
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyFilters(): void { this.currentPage = 1; this.loadTransactions(); }

  resetFilters(): void {
    this.filters = {
      account_id: '', transaction_type: '', status: '',
      date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      date_to:   new Date().toISOString().split('T')[0],
      search:    ''
    };
    this.applyFilters();
  }

  openNew(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedTx = null;
    this.proofFile = null;
    this.proofPreview = '';
    this.proofSizeInfo = '';
    const defaultAccount = this.filters.account_id || (this.accounts[0]?.id?.toString() || '');
    this.form.reset({
      bank_account_id: defaultAccount, transaction_type: 'DEPOT', amount: null,
      currency: 'GNF', transaction_date: new Date().toISOString().split('T')[0],
      reference: '', description: '', proof_type: null, status: 'COMPLETED'
    });
    this.showModal = true;
  }

  openEdit(tx: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedTx = tx;
    this.proofFile = null;
    this.proofPreview = tx.proof_url || '';
    this.proofSizeInfo = '';
    this.form.patchValue({
      bank_account_id:  tx.bank_account_id,
      transaction_type: tx.transaction_type,
      amount:           tx.amount,
      currency:         tx.currency,
      transaction_date: tx.transaction_date,
      reference:        tx.reference || '',
      description:      tx.description || '',
      proof_type:       tx.proof_type || null,
      status:           tx.status
    });
    this.showModal = true;
  }

  // ─── Image compression via Canvas ────────────────────────────────────────

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const raw = input.files[0];

    if (raw.type === 'application/pdf' && raw.size > 1.7 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'PDF trop volumineux', text: 'Les PDF doivent faire moins de 1,7 Mo. Les images sont compressées automatiquement.' });
      input.value = '';
      return;
    }
    if (raw.size > 30 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Fichier trop volumineux', text: 'Taille maximale : 30 Mo avant compression' });
      input.value = '';
      return;
    }

    if (raw.type.startsWith('image/')) {
      this.proofSizeInfo = `Compression en cours...`;
      this.cdr.detectChanges();
      const compressed = await this.compressImage(raw);
      this.proofFile = compressed;
      const pct = Math.round((1 - compressed.size / raw.size) * 100);
      this.proofSizeInfo = `${this.fmtSize(raw.size)} → ${this.fmtSize(compressed.size)}${pct > 5 ? ` (−${pct}%)` : ''}`;

      const reader = new FileReader();
      reader.onload = (e) => { this.proofPreview = e.target?.result as string; this.cdr.detectChanges(); };
      reader.readAsDataURL(compressed);
    } else {
      // PDF — no compression
      this.proofFile = raw;
      this.proofPreview = 'pdf';
      this.proofSizeInfo = this.fmtSize(raw.size);
      this.cdr.detectChanges();
    }
  }

  private compressImage(file: File): Promise<File> {
    // Hard target: stay under 1.5MB so PHP's 2MB limit is never hit
    const TARGET_BYTES = 1.2 * 1024 * 1024;
    const MAX_WIDTH    = 1920;

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          // Already small enough — no compression needed
          if (img.width <= MAX_WIDTH && file.size <= 400 * 1024) {
            resolve(file);
            return;
          }

          const compress = (scaleFactor: number, quality: number): void => {
            let w = Math.round(img.width * scaleFactor);
            let h = Math.round(img.height * scaleFactor);
            if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }

            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

            canvas.toBlob(blob => {
              if (!blob) { resolve(file); return; }

              if (blob.size <= TARGET_BYTES) {
                // Good size reached
                const name = file.name.replace(/\.[^.]+$/, '.jpg');
                resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
                return;
              }

              // Still too big — try lower quality first, then reduce dimensions
              if (quality > 0.40) {
                compress(scaleFactor, Math.round((quality - 0.15) * 100) / 100);
              } else if (scaleFactor > 0.35) {
                // Reduce dimensions by 25% and restart at quality 0.75
                compress(scaleFactor * 0.75, 0.75);
              } else {
                // Best effort — use what we have (will be < 2MB for any real photo)
                const name = file.name.replace(/\.[^.]+$/, '.jpg');
                resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
              }
            }, 'image/jpeg', quality);
          };

          compress(1.0, file.size > 5 * 1024 * 1024 ? 0.65 : 0.82);
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid) return;
    this.uploading = true;

    if (this.editMode && this.selectedTx) {
      // Update text fields via JSON
      this.apiService.put<any>(`banking/transactions/${this.selectedTx.id}`, this.form.value).subscribe({
        next: (r) => {
          if (r.success && this.proofFile) {
            this.doUploadProof(this.selectedTx.id, this.proofFile, () => {
              this.uploading = false;
              this.afterSave();
            });
          } else {
            this.uploading = false;
            if (r.success) this.afterSave();
          }
        },
        error: (e) => {
          this.uploading = false;
          Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur serveur' });
        }
      });

    } else {
      // Create: build FormData and POST — DO NOT set Content-Type manually
      const fd = new FormData();
      const val = this.form.value;
      Object.entries(val).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          fd.append(key, String(value));
        }
      });
      if (this.proofFile) {
        if (this.proofFile.size > 1.8 * 1024 * 1024) {
          this.uploading = false;
          Swal.fire({ icon: 'warning', title: 'Fichier encore trop lourd', text: `${this.fmtSize(this.proofFile.size)} — réduisez la résolution et réessayez.` });
          return;
        }
        fd.append('proof_file', this.proofFile, this.proofFile.name);
      }

      // Let the interceptor add Authorization; don't set any custom headers here
      this.http.post<any>(`${environment.apiUrl}/banking/transactions`, fd).subscribe({
        next: (r) => {
          this.uploading = false;
          if (r.success) {
            this.afterSave();
          } else {
            Swal.fire({ icon: 'error', title: 'Erreur', text: r.message || 'Erreur serveur' });
          }
        },
        error: (e) => {
          this.uploading = false;
          const msg = e?.error?.message || e?.message || 'Erreur serveur';
          Swal.fire({ icon: 'error', title: 'Erreur', text: msg });
        }
      });
    }
  }

  private doUploadProof(txId: number, file: File, callback: () => void): void {
    const fd = new FormData();
    fd.append('proof_file', file, file.name);
    const pt = this.form.get('proof_type')?.value;
    if (pt) fd.append('proof_type', pt);

    this.http.post<any>(`${environment.apiUrl}/banking/transactions/${txId}/upload-proof`, fd).subscribe({
      next: callback,
      error: () => callback() // proceed even if proof upload fails
    });
  }

  private afterSave(): void {
    Swal.fire({ icon: 'success', title: this.editMode ? 'Transaction modifiée' : 'Transaction créée', timer: 1500, showConfirmButton: false });
    this.showModal = false;
    this.proofFile = null;
    this.proofPreview = '';
    this.loadTransactions();
    this.loadAccounts();
  }

  viewProof(tx: any): void {
    if (!tx.proof_url) return;
    this.proofViewUrl  = tx.proof_url;
    this.proofViewType = tx.proof_url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
    this.showProofModal = true;
  }

  delete(tx: any): void {
    Swal.fire({
      title: 'Supprimer cette transaction ?',
      text: 'Le solde du compte sera recalculé.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.apiService.delete<any>(`banking/transactions/${tx.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Supprimé', timer: 1400, showConfirmButton: false });
          this.loadTransactions();
          this.loadAccounts();
        },
        error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur' })
      });
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  txTypeInfo(type: string) { return this.txTypes.find(t => t.value === type) || { label: type, color: 'secondary', icon: 'cilMinus' }; }
  statusInfo(s: string) { return this.statuses.find(x => x.value === s) || { label: s, color: 'secondary' }; }
  isCredit(type: string): boolean { return ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT'].includes(type); }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  fmtSize(bytes: number): string {
    if (bytes < 1024)        return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  get totalPages(): number { return Math.ceil(this.totalItems / this.perPage); }
  goToPage(p: number): void { if (p < 1 || p > this.totalPages) return; this.currentPage = p; this.loadTransactions(); }
}
