// js/utils.js
// Funções utilitárias globais para o app.js

const Utils = {

    // ===== FORMATAÇÃO =====
    formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString + 'T00:00:00'); // Tratar como data local
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    },

    formatCpfCnpj(value) {
        if (!value) return '';
        const numbers = value.replace(/\D/g, '');
        
        if (numbers.length === 11) {
            return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (numbers.length === 14) {
            return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return value;
    },

    // ===== DATAS =====
    hoje() {
        return new Date().toISOString().split('T')[0];
    },

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    },

    // ===== TEMPLATES DE TEXTO =====
    getDocumentTemplate(type, data) {
        if (type === 'orcamento') {
            return {
                title: 'ORÇAMENTO',
                header: `Orçamento válido por ${data.validadeDias || 30} dias`,
                footer: `Este é um orçamento da ${data.companyName || 'MSI'}. Os valores e condições apresentados são válidos até ${this.formatDate(this.addDays(this.hoje(), data.validadeDias || 30))}.`,
                notes: data.observations || 'Agradecemos a oportunidade de apresentar nossa proposta.'
            };
        } else {
            return {
                title: 'RECIBO',
                header: `Recebemos de ${data.clientName}`,
                footer: `Declaro que recebi o valor acima referente aos serviços prestados.`,
                notes: data.observations || 'Obrigado pela preferência!'
            };
        }
    },

    // ===== CÁLCULOS =====
    calculateSubtotal(items) {
        return items.reduce((sum, item) => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            return sum + (qty * price);
        }, 0);
    },

    calculateDiscount(subtotal, discountPercent) {
        return (subtotal * (discountPercent / 100));
    },

    calculateTotal(subtotal, discount, tax) {
        return subtotal - discount + tax;
    },

    calculateInstallments(total, numberOfInstallments) {
        const installmentValue = total / numberOfInstallments;
        
        return Array.from({ length: numberOfInstallments }, (_, i) => ({
            number: i + 1,
            value: installmentValue,
            formatted: this.formatMoney(installmentValue)
        }));
    },

    // ===== DEBOUNCE =====
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // ===== STATUS =====
    getStatusColor(status) {
        const colors = {
            'Aguardando': '#f59e0b',
            'Aprovado': '#10b981',
            'Em Execução': '#3b82f6',
            'Concluído': '#8b5cf6',
            'Faturado': '#06b6d4',
            'Pago': '#10b981',
            'Cancelado': '#ef4444'
        };
        return colors[status] || '#64748b';
    }
};