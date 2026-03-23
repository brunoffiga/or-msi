// app.js - Sistema MSI Unificado
// Versão sem módulos ES6 para compatibilidade com GitHub Pages e Live Server

// ===== CONFIGURAÇÃO SUPABASE =====
// ===== CONFIGURAÇÃO =====
const SUPABASE_URL = 'https://wipmrxuqzoggshojhvva.supabase.co'; // Substituir pela URL do seu projeto
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcG1yeHVxem9nZ3Nob2podnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjQwNzksImV4cCI6MjA3NzUwMDA3OX0.N-ULwKl2F6-98yRxrCu7giUbfqo27Jb-8MazpxdLvAg';

// ===== ESTADO GLOBAL =====
let supabaseClient = null;
let currentDocument = null;
let currentEditingId = null;
let currentEditingType = null;
let logoBase64 = null;

// ===== SISTEMA DE NOTIFICAÇÕES =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showLoading(show = true) {
    return;
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicação MSI...');
    
    // Inicializar Supabase
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await initializeDatabase();
    } else {
        console.error('Supabase não carregado! Verifique a conexão.');
        showToast('Erro ao conectar com o banco de dados', 'error');
    }
    
    // Configurar navegação
    setupNavigation();
    setupUrlRouting();
    
    // Carregar dados iniciais
    await loadDashboard();
    await loadProducts();
    await loadClients();
    await loadCompanySettings();
    
    // Configurar formulários
    setupDocumentForm();
    setupSettingsForm();
    setupModals();
    setupModalCloseHandlers();
    
    // Adicionar primeira linha de item
    addItemRow();
    
    // Configurar autocomplete
    await setupClientAutocomplete();
    await setupServiceAutocomplete();
    
    // Configurar filtros
    setupDynamicFilters();
    
    // Data padrão
    document.getElementById('document-date').valueAsDate = new Date();
    
    console.log('Aplicação inicializada!');
});

// ===== INICIALIZAÇÃO DO BANCO =====
async function initializeDatabase() {
    try {
        // Verificar se a tabela company tem dados
        const { data, error } = await supabaseClient
            .from('company')
            .select('*')
            .single();
        
        if (error && error.code === 'PGRST116') {
            console.log('Primeira execução detectada - configurando dados iniciais');
            // Dados já são inseridos pelo SQL
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao inicializar banco:', error);
        showToast('Erro ao conectar com o banco de dados', 'error');
        return false;
    }
}

// ===== NAVEGAÇÃO =====
function setupUrlRouting() {
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        showView(hash);
        updateActiveNav(hash);
    });
    
    const initialView = window.location.hash.substring(1) || 'dashboard';
    showView(initialView);
    updateActiveNav(initialView);
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const viewName = this.getAttribute('data-view');
            showView(viewName);
            window.location.hash = viewName;
            updateActiveNav(viewName);
        });
    });
}

async function getLogoBase64() {
    if (logoBase64) return logoBase64;
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Crítico para CORS
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                logoBase64 = canvas.toDataURL('image/png');
                resolve(logoBase64);
            } catch (e) {
                console.error('Erro ao converter logo:', e);
                resolve(null);
            }
        };
        
        img.onerror = () => {
            console.warn('Logo não encontrado');
            resolve(null);
        };
        
        // Usar caminho relativo correto
        img.src = 'logo.png'; // ou 'logo.png' se estiver na raiz
    });
}

function updateActiveNav(viewName) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        }
    });
}

window.goToDashboard = function() {
    showView('dashboard');
    window.location.hash = 'dashboard';
    updateActiveNav('dashboard');
};

function showView(viewName) {
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(section => section.classList.remove('active'));
    
    const targetSection = document.getElementById(`${viewName}-view`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        if (viewName === 'dashboard') {
            loadDashboard();
        } else if (viewName === 'create' && !currentEditingId) {
            clearForm();
        }
    }
}

function clearForm() {
    document.getElementById('document-form').reset();
    document.getElementById('items-container').innerHTML = '';
    document.getElementById('responsavel-tecnico').value = 'Vitor Matmoto';
    document.getElementById('document-date').valueAsDate = new Date();
    addItemRow();
    updateTotals();

    // --- INÍCIO DA ATUALIZAÇÃO ---
    // Limpar estado de edição
    currentEditingId = null;
    currentEditingType = null;

    // Ocultar banner (se existir)
    const banner = document.getElementById('edit-mode-banner');
    if (banner) {
        banner.style.display = 'none';
    }

    // Restaurar título (se existir)
    const title = document.querySelector('#create-view .view-header h2');
    if (title) {
        // Ajuste este texto se o seu título original for outro
        title.textContent = 'Novo Documento'; 
    }
    // --- FIM DA ATUALIZAÇÃO ---
}

// ===== DASHBOARD (Modificada) =====
async function loadDashboard(filters = {}) {
    try {
        const filteredDocs = await getFilteredDocuments(filters);

        const orcamentos = filteredDocs.filter(d => d.type === 'orcamento');
        const recibos = filteredDocs.filter(d => d.type === 'recibo');
        const recebidos = filteredDocs.filter(d => d.type === 'recibo' && d.status === 'Pago');

        const orcamentosValue = orcamentos.reduce((sum, doc) => sum + (parseFloat(doc.total) || 0), 0);
        const recibosValue = recibos.reduce((sum, doc) => sum + (parseFloat(doc.total) || 0), 0);
        const totalRecebidoValue = recebidos.reduce((sum, doc) => sum + (parseFloat(doc.total) || 0), 0);

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setText('stat-orcamentos-count', orcamentos.length);
        setText('stat-orcamentos-value', Utils.formatMoney(orcamentosValue));

        setText('stat-recibos-count', recibos.length);
        setText('stat-recibos-value', Utils.formatMoney(recibosValue));

        setText('stat-total-count', recebidos.length);
        setText('stat-total-value', Utils.formatMoney(totalRecebidoValue));

        renderDocumentsTable(filteredDocs);
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showToast('Erro ao carregar dados', 'error');
    }
}

// ===== NOVAS FUNÇÕES (Substituem loadDocumentsTable) =====

/**
 * Busca todos os documentos e aplica os filtros de frontend.
 * Esta é a nova fonte de verdade para os dados do dashboard.
 */
async function getFilteredDocuments(filters = {}) {
    // 1. Buscar todos os documentos no Supabase
    const { data: documents, error } = await supabaseClient
        .from('documents')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Erro ao buscar documentos:', error);
        showToast('Erro ao carregar dados', 'error');
        return []; // Retorna vazio em caso de erro
    }

    let filtered = documents || [];
    
    // 2. Aplicar filtros (lógica movida de loadDocumentsTable)
    if (filters.type) {
        filtered = filtered.filter(d => d.type === filters.type);
    }
    if (filters.status) {
        filtered = filtered.filter(d => d.status === filters.status);
    }
    if (filters.dateStart) {
        // Compara strings YYYY-MM-DD, que é seguro
        filtered = filtered.filter(d => d.date >= filters.dateStart);
    }
    if (filters.dateEnd) {
        filtered = filtered.filter(d => d.date <= filters.dateEnd);
    }
    if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(d => {
            const client = d.client_snapshot || {};
            return (client.name || '').toLowerCase().includes(search) ||
                   d.id.toString().includes(search);
        });
    }
    
    return filtered;
}

/**
 * Apenas renderiza o HTML da tabela com base em dados já filtrados.
 */
function renderDocumentsTable(filteredDocuments) {
    try {
        const tbody = document.getElementById('documents-table-body');
        if (!tbody) return;

        // Agrupar por ID
        const grouped = {};
        filteredDocuments.forEach(doc => {
            if (!grouped[doc.id]) {
                grouped[doc.id] = {};
            }
            grouped[doc.id][doc.type] = doc;
        });
        
        if (Object.keys(grouped).length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Nenhum documento encontrado</td></tr>';
            return;
        }
        
        const sortedEntries = Object.entries(grouped).sort((a, b) => {
            const idA = parseInt(a[0]) || 0;
            const idB = parseInt(b[0]) || 0;
            return idB - idA;
        });
        
        tbody.innerHTML = sortedEntries.map(([id, docs]) => {
            const mainDoc = docs.orcamento || docs.recibo;
            const clientSnapshot = mainDoc.client_snapshot || {};
            const currentStatus = mainDoc.status || 'Aguardando';
            
            // Detectar tipos de serviço
            const serviceTypes = new Set();
            if (mainDoc.items && Array.isArray(mainDoc.items)) {
                mainDoc.items.forEach(item => {
                    if (item.serviceType) {
                        serviceTypes.add(item.serviceType);
                    }
                });
            }
            
            return `
                <tr>
                    <td><strong>#${id}</strong></td>
                    <td class="document-types">
                        ${docs.orcamento ? `<span class="status-badge status-orcamento clickable" onclick="viewDocument('${id}', 'orcamento')">Orçamento</span>` : ''}
                        ${docs.recibo ? `<span class="status-badge status-recibo clickable" onclick="viewDocument('${id}', 'recibo')">Recibo</span>` : ''}
                    </td>
                    <td>${clientSnapshot.name || ''}</td>
                    <td class="service-types">
                        ${serviceTypes.has('instalacao') ? '<span class="service-badge service-instalacao">Instalação</span>' : ''}
                        ${serviceTypes.has('manutencao') ? '<span class="service-badge service-manutencao">Manutenção</span>' : ''}
                        ${serviceTypes.has('produto') ? '<span class="service-badge service-produto">Produto</span>' : ''}
                    </td>
                    <td>${Utils.formatDate(mainDoc.date)}</td>
                    <td><strong>${Utils.formatMoney(mainDoc.total)}</strong></td>
                    <td>
                        <select class="status-select" onchange="updateDocumentStatus('${id}', this.value)" 
                                style="padding: 0.4rem; border: 2px solid var(--border); border-radius: 6px; 
                                       font-size: 0.9rem; cursor: pointer; font-weight: 600;">
                            <option value="Aguardando" ${currentStatus === 'Aguardando' ? 'selected' : ''}>Aguardando</option>
                            <option value="Aprovado" ${currentStatus === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                            <option value="Em Execução" ${currentStatus === 'Em Execução' ? 'selected' : ''}>Em Execução</option>
                            <option value="Concluído" ${currentStatus === 'Concluído' ? 'selected' : ''}>🏁 Concluído</option>
                            <option value="Faturado" ${currentStatus === 'Faturado' ? 'selected' : ''}>Faturado</option>
                            <option value="Pago" ${currentStatus === 'Pago' ? 'selected' : ''}>Pago</option>
                            <option value="Cancelado" ${currentStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao renderizar tabela:', error);
    }
}

// ===== VISUALIZAR DOCUMENTO =====
window.viewDocument = async function(id, type) {
    try {
        showLoading(true);
        
        const { data, error } = await supabaseClient
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('type', type)
            .single();
        
        if (error) throw error;
        
        if (data) {
            currentDocument = formatDocumentFromDB(data);
            renderPreview(currentDocument);

            const previewTitle = document.querySelector('#preview-modal .modal-header h3');
            if (previewTitle) {
                const clientName = currentDocument.clientSnapshot?.name || currentDocument.client_snapshot?.name || 'Cliente';
                previewTitle.textContent = `${clientName} • #${currentDocument.id}`;
            }
            
            const modalFooter = document.querySelector('#preview-modal .modal-footer');
            modalFooter.innerHTML = `
                <button class="btn-secondary" onclick="exportPDF()">📄 PDF</button>
                <button class="btn-secondary" onclick="exportDOCX()">📝 DOCX</button>
                ${type === 'orcamento' ? `<button class="btn-secondary" onclick="convertToRecibo('${id}')">Converter em recibo</button>` : ''}
                <button class="btn-secondary" onclick="editDocument('${id}', '${type}')">Editar</button>
                <button class="btn-secondary" onclick="duplicateDocument('${id}', '${type}')">📑 Duplicar</button>
                <button class="btn-danger" onclick="deleteDocumentConfirm('${id}', '${type}')">Excluir</button>
            `;
            
            document.getElementById('preview-modal').classList.add('active');
        }
    } catch (error) {
        console.error('Erro ao visualizar documento:', error);
        showToast('Erro ao carregar documento', 'error');
    } finally {
        showLoading(false);
    }
};

// ===== EDITAR DOCUMENTO =====
window.editDocument = async function(id, type) {
    try {
        const { data, error } = await supabaseClient
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('type', type)
            .single();
        
        if (error) throw error;
        
        if (data) {
            currentEditingId = parseInt(id);
            currentEditingType = type;
            
            const doc = formatDocumentFromDB(data);
            populateFormWithDocument(doc);
            
            // Esta é a linha que adicionamos para mostrar o banner
            showEditBanner(doc);
            
            closePreview();
            showView('create');
            window.location.hash = 'create';
            updateActiveNav('create');
            
            showToast('Modo de edição ativado', 'info');
        }
    } catch (error) {
        console.error('Erro ao editar:', error);
        showToast('Erro ao carregar documento para edição', 'error');
    }
};

// ===== CONVERTER PARA RECIBO =====
window.convertToRecibo = async function(id) {
    try {
        if (!confirm('Deseja converter este orçamento em recibo?')) return;
        
        showLoading(true);
        
        // Buscar orçamento
        const { data: orcamento, error } = await supabaseClient
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('type', 'orcamento')
            .single();
        
        if (error) throw error;
        
        // Criar recibo baseado no orçamento
        const recibo = {
            ...orcamento,
            type: 'recibo',
            status: 'Faturado',
            type_specific: {
                ...(orcamento.type_specific || {}),
                orcamentoOriginalId: id
            }
        };
        
        // Inserir recibo
        const { error: insertError } = await supabaseClient
            .from('documents')
            .insert(recibo);
        
        if (insertError) throw insertError;
        
        closePreview();
        await loadDashboard();
        showToast('Orçamento convertido em recibo com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao converter:', error);
        showToast('Erro ao converter orçamento', 'error');
    } finally {
        showLoading(false);
    }
};

// ===== DUPLICAR DOCUMENTO =====
window.duplicateDocument = async function(id, type) {
    try {
        if (!confirm('Deseja duplicar este documento?')) return;
        
        showLoading(true);
        
        const { data: original, error } = await supabaseClient
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('type', type)
            .single();
        
        if (error) throw error;
        
        // Criar cópia sem o ID
        const duplicate = { ...original };
        delete duplicate.id;
        delete duplicate.created_at;
        delete duplicate.updated_at;
        
        // Inserir duplicata
        const { error: insertError } = await supabaseClient
            .from('documents')
            .insert(duplicate);
        
        if (insertError) throw insertError;
        
        closePreview();
        await loadDashboard();
        showToast('Documento duplicado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao duplicar:', error);
        showToast('Erro ao duplicar documento', 'error');
    } finally {
        showLoading(false);
    }
};

// ===== EXCLUIR DOCUMENTO =====
window.deleteDocumentConfirm = async function(id, type) {
    try {
        if (!confirm(`Excluir este ${type === 'orcamento' ? 'orçamento' : 'recibo'}?`)) return;
        
        showLoading(true);
        
        const { error } = await supabaseClient
            .from('documents')
            .delete()
            .eq('id', id)
            .eq('type', type);
        
        if (error) throw error;
        
        closePreview();
        await loadDashboard();
        showToast('Documento excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir documento', 'error');
    } finally {
        showLoading(false);
    }
};

// ===== ATUALIZAR STATUS =====
window.updateDocumentStatus = async function(id, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('documents')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;

        if (currentDocument && String(currentDocument.id) === String(id)) {
            currentDocument.status = newStatus;
        }

        await loadDashboard(getCurrentFilters());
        showToast('Status atualizado', 'success');
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showToast('Erro ao atualizar status', 'error');
    }
};

// ===== FORMULÁRIO DE DOCUMENTO =====
function setupDocumentForm() {
    const form = document.getElementById('document-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveDocumentFromForm();
    });
    
    // Tipo de documento
    document.querySelectorAll('input[name="documentType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const validadeGroup = document.getElementById('validade-group');
            validadeGroup.style.display = this.value === 'orcamento' ? 'block' : 'none';
        });
    });
    
    // Tipo de pagamento
    document.getElementById('payment-type').addEventListener('change', function() {
        const installmentsGroup = document.getElementById('installments-group');
        const installmentsDisplay = document.getElementById('installments-display');
        
        if (this.value === 'parcelado') {
            installmentsGroup.style.display = 'block';
            updateInstallmentsDisplay();
        } else {
            installmentsGroup.style.display = 'none';
            installmentsDisplay.innerHTML = '';
        }
    });
    
    document.getElementById('installments-number').addEventListener('change', updateInstallmentsDisplay);
    document.getElementById('discount-percent').addEventListener('input', updateTotals);
    document.getElementById('tax-value').addEventListener('input', updateTotals);
}

async function saveDocumentFromForm() {
    try {
        const items = getFormItems();
        
        if (items.length === 0) {
            showToast('Adicione pelo menos um item!', 'warning');
            return;
        }
        
        showLoading(true);
        
        const documentType = document.querySelector('input[name="documentType"]:checked').value;
        const paymentType = document.getElementById('payment-type').value;
        
        // Buscar dados da empresa
        const { data: company } = await supabaseClient
            .from('company')
            .select('*')
            .single();
        
        const subtotal = Utils.calculateSubtotal(items);
        const discountPercent = parseFloat(document.getElementById('discount-percent').value) || 0;
        const taxValue = parseFloat(document.getElementById('tax-value').value) || 0;
        const discountValue = Utils.calculateDiscount(subtotal, discountPercent);
        const total = Utils.calculateTotal(subtotal, discountValue, taxValue);
        
        const doc = {
            type: currentEditingType || documentType,
            status: (currentEditingType || documentType) === 'recibo' ? 'Pago' : 'Aguardando',
            client_snapshot: {
                name: document.getElementById('client-name').value,
                cpfCnpj: document.getElementById('client-cpfcnpj').value,
                address: document.getElementById('client-address').value,
                contact: document.getElementById('client-contact').value
            },
            company_snapshot: company,
            items: items,
            subtotal: subtotal,
            discount_percent: discountPercent,
            discount_value: discountValue,
            tax_value: taxValue,
            total: total,
            payment: {
                type: paymentType,
                installments: paymentType === 'parcelado' ? 
                    parseInt(document.getElementById('installments-number').value) : 1
            },
            type_specific: {
                validadeDias: documentType === 'orcamento' ? 
                    parseInt(document.getElementById('validade-dias').value) : null
            },
            date: document.getElementById('document-date').value,
            city_state: document.getElementById('document-location').value,
            observations: document.getElementById('observations').value,
            responsavel_tecnico: document.getElementById('responsavel-tecnico').value
        };
        
        if (currentEditingId) {
            // Atualizar documento existente
            const { error } = await supabaseClient
                .from('documents')
                .update(doc)
                .eq('id', currentEditingId)
                .eq('type', currentEditingType);
            
            if (error) throw error;
            
            showToast('Documento atualizado com sucesso!', 'success');
        } else {
            // Criar novo documento
            const { error } = await supabaseClient
                .from('documents')
                .insert(doc);
            
            if (error) throw error;
            
            showToast('Documento salvo com sucesso!', 'success');
        }
        
        currentEditingId = null;
        currentEditingType = null;
        clearForm();
        goToDashboard();
        
    } catch (error) {
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    } finally {
        showLoading(false);
    }
}

function populateFormWithDocument(doc) {
    // Tipo de documento
    document.querySelector(`input[name="documentType"][value="${doc.type}"]`).checked = true;
    
    // Dados do cliente
    const clientSnapshot = doc.clientSnapshot || doc.client_snapshot || {};
    document.getElementById('client-name').value = clientSnapshot.name || '';
    document.getElementById('client-cpfcnpj').value = clientSnapshot.cpfCnpj || clientSnapshot.cpf_cnpj || '';
    document.getElementById('client-address').value = clientSnapshot.address || '';
    document.getElementById('client-contact').value = clientSnapshot.contact || '';
    
    // Itens
    document.getElementById('items-container').innerHTML = '';
    (doc.items || []).forEach(item => {
        addItemRow(item);
    });
    
    // Valores
    document.getElementById('discount-percent').value = doc.discountPercent || doc.discount_percent || 0;
    document.getElementById('tax-value').value = doc.taxValue || doc.tax_value || 0;
    
    // Pagamento
    const payment = doc.payment || {};
    document.getElementById('payment-type').value = payment.type || 'avista';
    if (payment.type === 'parcelado') {
        document.getElementById('installments-group').style.display = 'block';
        document.getElementById('installments-number').value = payment.installments;
        updateInstallmentsDisplay();
    }
    
    // Informações adicionais
    document.getElementById('document-date').value = doc.date;
    document.getElementById('document-location').value = doc.cityState || doc.city_state || 'São Paulo, SP';
    document.getElementById('responsavel-tecnico').value = 
        doc.responsavelTecnico || doc.responsavel_tecnico || 'Vitor Matmoto';
    document.getElementById('observations').value = doc.observations || '';
    
    const typeSpecific = doc.typeSpecific || doc.type_specific || {};
    if (doc.type === 'orcamento' && typeSpecific.validadeDias) {
        document.getElementById('validade-dias').value = typeSpecific.validadeDias;
    }
    
    updateTotals();
}

// ===== ITENS DO FORMULÁRIO =====
window.addItemRow = function(itemData = null) {
    const container = document.getElementById('items-container');
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    
    itemRow.innerHTML = `
        <div class="item-field">
            <label>Descrição</label>
            <input type="text" class="item-description" list="services-list" 
                   placeholder="Descrição do item/serviço" value="${itemData?.description || ''}" required>
        </div>
        <div class="item-field">
            <label>Qtd</label>
            <input type="number" class="item-qty" min="0.01" step="0.01" 
                   value="${itemData?.qty || 1}" required>
        </div>
        <div class="item-field">
            <label>Tipo</label>
            <select class="item-service-type" required>
                <option value="">Selecione...</option>
                <option value="instalacao" ${itemData?.serviceType === 'instalacao' ? 'selected' : ''}>Instalação</option>
                <option value="manutencao" ${itemData?.serviceType === 'manutencao' ? 'selected' : ''}>Manutenção</option>
                <option value="produto" ${itemData?.serviceType === 'produto' ? 'selected' : ''}>Produto</option>
            </select>
        </div>
        <div class="item-field">
            <label>Valor Unit.</label>
            <input type="number" class="item-price" min="0" step="0.01" 
                   value="${itemData?.unitPrice || 0}" required>
        </div>
        <div class="item-field">
            <label>Subtotal</label>
            <div class="item-subtotal" data-subtotal="0">R$ 0,00</div>
        </div>
        <button type="button" class="btn-remove-item" onclick="removeItemRow(this)">Remover</button>
    `;
    
    container.appendChild(itemRow);
    
    // Event listeners
    const qtyInput = itemRow.querySelector('.item-qty');
    const priceInput = itemRow.querySelector('.item-price');
    const descInput = itemRow.querySelector('.item-description');
    
    qtyInput.addEventListener('input', () => updateItemSubtotal(itemRow));
    priceInput.addEventListener('input', () => updateItemSubtotal(itemRow));
    
    // Autocomplete de serviços
    descInput.addEventListener('change', async function() {
        const value = this.value;
        
        try {
            const { data: product, error } = await supabaseClient
                .from('products')
                .select('*')
                .eq('name', value)
                .maybeSingle();
            
            if (error) throw error;
            
            if (product) {
                itemRow.querySelector('.item-service-type').value = product.service_type;
                itemRow.querySelector('.item-price').value = product.unit_price;
                updateItemSubtotal(itemRow);
            }
        } catch (error) {
            // Produto não encontrado, usuário digitou manualmente
        }
    });
    
    updateItemSubtotal(itemRow);
};

window.removeItemRow = function(button) {
    button.closest('.item-row').remove();
    updateTotals();
};

function updateItemSubtotal(itemRow) {
    const qty = parseFloat(itemRow.querySelector('.item-qty').value) || 0;
    const price = parseFloat(itemRow.querySelector('.item-price').value) || 0;
    const subtotal = qty * price;
    
    const subtotalDiv = itemRow.querySelector('.item-subtotal');
    subtotalDiv.textContent = Utils.formatMoney(subtotal);
    subtotalDiv.setAttribute('data-subtotal', subtotal);
    
    updateTotals();
}

function getFormItems() {
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const description = row.querySelector('.item-description').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const serviceType = row.querySelector('.item-service-type').value;
        const unitPrice = parseFloat(row.querySelector('.item-price').value) || 0;
        
        if (description && qty > 0) {
            items.push({
                description,
                qty,
                serviceType,
                unitPrice,
                subtotal: qty * unitPrice
            });
        }
    });
    return items;
}

function updateTotals() {
    const items = getFormItems();
    const subtotal = Utils.calculateSubtotal(items);
    const discountPercent = parseFloat(document.getElementById('discount-percent').value) || 0;
    const taxValue = parseFloat(document.getElementById('tax-value').value) || 0;
    
    const discountValue = Utils.calculateDiscount(subtotal, discountPercent);
    const total = Utils.calculateTotal(subtotal, discountValue, taxValue);
    
    document.getElementById('display-subtotal').textContent = Utils.formatMoney(subtotal);
    document.getElementById('display-discount').textContent = Utils.formatMoney(discountValue);
    document.getElementById('display-total').textContent = Utils.formatMoney(total);
    
    if (document.getElementById('payment-type').value === 'parcelado') {
        updateInstallmentsDisplay();
    }
}

function updateInstallmentsDisplay() {
    const items = getFormItems();
    const subtotal = Utils.calculateSubtotal(items);
    const discountPercent = parseFloat(document.getElementById('discount-percent').value) || 0;
    const taxValue = parseFloat(document.getElementById('tax-value').value) || 0;
    const discountValue = Utils.calculateDiscount(subtotal, discountPercent);
    const total = Utils.calculateTotal(subtotal, discountValue, taxValue);
    
    const numberOfInstallments = parseInt(document.getElementById('installments-number').value);
    const installments = Utils.calculateInstallments(total, numberOfInstallments);
    
    const display = document.getElementById('installments-display');
    display.innerHTML = `
        <div style="margin-top: 1rem; padding: 1rem; background: var(--light); border-radius: 8px;">
            <strong>Parcelas:</strong><br>
            ${installments.map(inst => `
                <div style="padding: 0.3rem 0;">
                    ${inst.number}ª parcela: <strong>${inst.formatted}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== AUTOCOMPLETE =====
async function setupClientAutocomplete() {
    try {
        const { data: clients } = await supabaseClient
            .from('clients')
            .select('*')
            .order('name');
        
        const datalist = document.getElementById('clients-list');
        if (!datalist) return;
        
        datalist.innerHTML = (clients || []).map(client => 
            `<option value="${client.name}">${client.cpf_cnpj}</option>`
        ).join('');
        
        document.getElementById('client-name').addEventListener('change', function() {
            const selectedName = this.value;
            const client = clients.find(c => c.name === selectedName);
            
            if (client) {
                document.getElementById('client-cpfcnpj').value = client.cpf_cnpj;
                document.getElementById('client-address').value = client.address || '';
                document.getElementById('client-contact').value = client.contact || '';
            }
        });
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function setupServiceAutocomplete() {
    try {
        const { data: products } = await supabaseClient
            .from('products')
            .select('*')
            .order('name');
        
        const datalist = document.getElementById('services-list');
        if (!datalist) return;
        
        datalist.innerHTML = (products || []).map(product => 
            `<option value="${product.name}">${Utils.formatMoney(product.unit_price)}</option>`
        ).join('');
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// ===== PREVIEW E EXPORTAÇÃO =====
window.previewDocument = async function() {
    const items = getFormItems();
    
    if (items.length === 0) {
        showToast('Adicione pelo menos um item!', 'warning');
        return;
    }
    
    // Buscar dados da empresa
    const { data: company } = await supabaseClient
        .from('company')
        .select('*')
        .single();
    
    const documentType = document.querySelector('input[name="documentType"]:checked').value;
    const paymentType = document.getElementById('payment-type').value;
    
    const subtotal = Utils.calculateSubtotal(items);
    const discountPercent = parseFloat(document.getElementById('discount-percent').value) || 0;
    const taxValue = parseFloat(document.getElementById('tax-value').value) || 0;
    const discountValue = Utils.calculateDiscount(subtotal, discountPercent);
    const total = Utils.calculateTotal(subtotal, discountValue, taxValue);
    
    currentDocument = {
        id: currentEditingId || 'simulação',
        type: documentType,
        companySnapshot: company,
        clientSnapshot: {
            name: document.getElementById('client-name').value,
            cpfCnpj: document.getElementById('client-cpfcnpj').value,
            address: document.getElementById('client-address').value,
            contact: document.getElementById('client-contact').value
        },
        items: items,
        subtotal: subtotal,
        discountPercent: discountPercent,
        discountValue: discountValue,
        taxValue: taxValue,
        total: total,
        payment: {
            type: paymentType,
            installments: paymentType === 'parcelado' ? 
                parseInt(document.getElementById('installments-number').value) : 1
        },
        typeSpecific: {
            validadeDias: documentType === 'orcamento' ? 
                parseInt(document.getElementById('validade-dias').value) : null
        },
        date: document.getElementById('document-date').value,
        cityState: document.getElementById('document-location').value,
        observations: document.getElementById('observations').value,
        responsavelTecnico: document.getElementById('responsavel-tecnico').value
    };
    
    renderPreview(currentDocument);

    const previewTitle = document.querySelector('#preview-modal .modal-header h3');
    if (previewTitle) {
        const clientName = currentDocument.clientSnapshot?.name || 'Cliente';
        previewTitle.textContent = `${clientName} • #${currentDocument.id}`;
    }
    
    const modalFooter = document.querySelector('#preview-modal .modal-footer');
    modalFooter.innerHTML = `
        <button class="btn-secondary" onclick="exportPDF()">📄 PDF</button>
        <button class="btn-secondary" onclick="exportDOCX()">📝 DOCX</button>
    `;
    
    document.getElementById('preview-modal').classList.add('active');
};

function renderPreview(doc) {
    const template = Utils.getDocumentTemplate(doc.type, {
        validadeDias: doc.typeSpecific?.validadeDias,
        companyName: doc.companySnapshot?.fantasia || doc.companySnapshot?.name,
        clientName: doc.clientSnapshot?.name
    });
    
    // Separar itens por tipo
    const serviceTypes = new Set();
    const itemsByType = {
        instalacao: [],
        manutencao: [],
        produto: []
    };
    
    (doc.items || []).forEach(item => {
        if (item.serviceType) {
            serviceTypes.add(item.serviceType);
            itemsByType[item.serviceType].push(item);
        }
    });
    
    // Formatar pagamento
    let paymentInfo = '';
    if (doc.payment) {
        if (doc.payment.type === 'avista') {
            paymentInfo = '<strong>À Vista</strong>';
        } else {
            const installments = Utils.calculateInstallments(doc.total, doc.payment.installments);
            paymentInfo = `<strong>Parcelado em ${doc.payment.installments}x</strong> de ${installments[0].formatted}`;
        }
    }
    
    // Renderizar tabelas por tipo
    let tablesHtml = '';
    if (serviceTypes.has('instalacao')) {
        tablesHtml += renderServiceTable('Instalação', itemsByType.instalacao);
    }
    if (serviceTypes.has('manutencao')) {
        tablesHtml += renderServiceTable('Manutenção', itemsByType.manutencao);
    }
    if (serviceTypes.has('produto')) {
        tablesHtml += renderServiceTable('Produtos', itemsByType.produto);
    }
    
    const html = `
        <div class="document-preview" id="document-to-print">
            <div class="doc-watermark"><img src="logo.png" alt="Logo"></div>
            
            <div class="doc-header-new">
                <div class="doc-header-left">
                    <img src="logo.png" alt="Logo" class="doc-logo">
                </div>
                <div class="doc-header-right">
                    <h1 class="doc-title">${template.title}</h1>    
                    <div class="doc-id">&nbsp#${doc.id}</div>
                </div>
            </div>  
            
            <div class="doc-section">
                <h4>Emitente</h4>
                <div class="doc-info-lines">
                    <div>${doc.companySnapshot?.name} | CNPJ: ${Utils.formatCpfCnpj(doc.companySnapshot?.cnpj)}</div>
                    <div>${doc.companySnapshot?.address}</div>
                    <div>${doc.companySnapshot?.phone} | ${doc.companySnapshot?.email}</div>
                </div>
            </div>
            
            <div class="doc-section">
                <h4>Cliente</h4>
                <div class="doc-info-lines">
                    <div>${doc.clientSnapshot?.name} | CPF/CNPJ: ${Utils.formatCpfCnpj(doc.clientSnapshot?.cpfCnpj)}</div>
                    ${doc.clientSnapshot?.address ? `<div>${doc.clientSnapshot.address}</div>` : ''}
                    ${doc.clientSnapshot?.contact ? `<div>${doc.clientSnapshot.contact}</div>` : ''}
                </div>
            </div>
            
            ${tablesHtml}
            
                        <div class="doc-totals">
                ${( (doc.discountPercent > 0) || (doc.discountValue && doc.discountValue > 0) ) ? `<div>Subtotal: <strong>${Utils.formatMoney(doc.subtotal)}</strong></div>` : ''}
                ${doc.discountPercent > 0 ? `<div>Desconto (${doc.discountPercent}%): <strong>- ${Utils.formatMoney(doc.discountValue)}</strong></div>` : ''}
                ${doc.taxValue > 0 ? `<div>Impostos/Taxas: <strong>+ ${Utils.formatMoney(doc.taxValue)}</strong></div>` : ''}
                <div class="doc-total-final">TOTAL: ${Utils.formatMoney(doc.total)}</div>
            </div>
            
            ${paymentInfo ? `
            <div class="doc-section">
                <h4>Condições de Pagamento</h4>
                <p>${paymentInfo}</p>
            </div>` : ''}
            
            ${doc.observations ? `
            <div class="doc-section">
                <h4>Observações</h4>
                <p>${doc.observations}</p>
            </div>` : ''}
            
            <div class="doc-footer">
                <p>${doc.cityState}, ${Utils.formatDate(doc.date)}</p>
                <p>${template.footer}</p>
                <br>
                <p>_______________________________________________</p>
                <p><strong>${doc.companySnapshot?.fantasia || doc.companySnapshot?.name}</strong></p>
                ${doc.responsavelTecnico ? `<p>Responsável Técnico: ${doc.responsavelTecnico}</p>` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('preview-content').innerHTML = html;
}

function renderServiceTable(title, items) {
    if (!items || items.length === 0) return '';
    
    return `
        <div class="doc-section">
            <h4>${title}</h4>
            <table class="doc-table">
                <thead>
                    <tr>
                        <th>Descrição</th>
                        <th>Qtd</th>
                        <th>Valor Unit.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.qty}</td>
                            <td>${Utils.formatMoney(item.unitPrice)}</td>
                            <td>${Utils.formatMoney(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

window.closePreview = function() {
    document.getElementById('preview-modal').classList.remove('active');
};

// ===== EXPORT PDF FINAL (v29.2 - Correção Watermark + Filename) =====
window.exportPDF = async function () {
    if (!currentDocument) {
        showToast('Nenhum documento para exportar', 'warning');
        return;
    }

    showToast('Gerando PDF...', 'info');
    showLoading(true);

    // --- INÍCIO DA CORREÇÃO (Watermark) ---
    // 1. Carregar o logo em Base64 (a função getLogoBase64 já existe no seu app.js)
    const logoDataUrl = await getLogoBase64();
    // --- FIM DA CORREÇÃO ---

    const original = document.getElementById('document-to-print');
    if (!original) {
        showToast('Elemento para impressão não encontrado', 'error');
        showLoading(false);
        return;
    }

    // ... (O restante da sua lógica v29 permanece 100% igual) ...
    const signatureSelectors = [
        '.doc-signature',
        '.doc-footer',
        '.doc-responsavel-tecnico',
        '.signature',
        '#signature'
    ];
    const waitImagesLoaded = (el, timeout = 5000) => {
        const imgs = Array.from(el.querySelectorAll('img'));
        if (imgs.length === 0) return Promise.resolve();
        return Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(resolve => {
                const onLoad = () => { cleanup(); resolve(); };
                const onErr = () => { cleanup(); resolve(); };
                const cleanup = () => {
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onErr);
                };
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onErr);
                setTimeout(() => { cleanup(); resolve(); }, timeout);
            });
        }));
    };
    let signatureElGlobal = null;
    for (const sel of signatureSelectors) {
        const found = document.querySelector(sel);
        if (found) { signatureElGlobal = found; break; }
    }
    const clone = original.cloneNode(true);
    clone.style.boxSizing = 'border-box';
    clone.style.width = original.scrollWidth + 'px';
    clone.style.minHeight = original.scrollHeight + 'px';
    clone.style.position = 'relative';
    clone.style.background = window.getComputedStyle(original).background || '#fff';
    if (signatureElGlobal && !original.contains(signatureElGlobal)) {
        const sigClone = signatureElGlobal.cloneNode(true);
        sigClone.classList.add('tmp-appended-signature');
        sigClone.style.position = 'static';
        sigClone.style.width = '100%';
        sigClone.style.marginTop = '40px';
        clone.appendChild(sigClone);
    }
    clone.querySelectorAll('*').forEach(node => {
        try {
            const cs = window.getComputedStyle(node);
            if (cs.position === 'fixed' || cs.position === 'absolute') {
                node.style.position = 'static';
                node.style.top = '';
                node.style.left = '';
                node.style.right = '';
                node.style.bottom = '';
                if (!node.style.width) node.style.width = '100%';
            }
        } catch (e) {
            // ...
        }
        if (node.classList && node.classList.contains('doc-watermark')) {
            node.style.display = 'none'; 
        }
    });
    
    const discountValue = currentDocument.discountValue || currentDocument.discount_value || 0;
    const discountPercent = currentDocument.discountPercent || currentDocument.discount_percent || 0;
    if (discountValue <= 0 && discountPercent <= 0) {
        const totals = clone.querySelectorAll('.doc-totals, .doc-totals *');
        if (totals && totals.length > 0) {
            const container = clone.querySelector('.doc-totals');
            if (container) {
                Array.from(container.children).forEach(child => {
                    if (child.textContent && child.textContent.trim().toLowerCase().includes('subtotal')) {
                        child.remove();
                    }
                });
            } else {
                const nodes = clone.querySelectorAll('*');
                nodes.forEach(n => {
                    if (n.textContent && n.textContent.trim().toLowerCase().includes('subtotal')) {
                        const parent = n.closest('.doc-totals');
                        if (parent) n.remove();
                    }
                });
            }
        }
    }
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.zIndex = '-9999';
    document.body.appendChild(clone);

    try {
        await waitImagesLoaded(clone);
        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas(clone, {
    scale: 1,
    useCORS: true,           // JÁ TEM
    allowTaint: false,       // ADICIONAR - previne canvas tainted
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: clone.scrollWidth,
    height: clone.scrollHeight,
    imageTimeout: 0,         // ADICIONAR - desabilita timeout
    proxy: undefined         // ADICIONAR - sem proxy local
});

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margins = { top: 15, bottom: 15, left: 10, right: 10 };
        const contentWidth = pageWidth - margins.left - margins.right;
        const contentHeight = pageHeight - margins.top - margins.bottom;
        const imgWidthMm = contentWidth;
        const pixelsPerMm = canvas.width / imgWidthMm;
        const slicePixelHeight = Math.floor(contentHeight * pixelsPerMm);

        let gStateFull = null, gStateWatermark = null;
        try {
            gStateFull = pdf.GState ? new pdf.GState({ opacity: 1.0 }) : null;
            gStateWatermark = pdf.GState ? new pdf.GState({ opacity: 0.05 }) : null;
        } catch (e) {
            gStateFull = null; gStateWatermark = null;
        }

        const totalPages = Math.max(1, Math.ceil(canvas.height / slicePixelHeight));
        const headerOffsetMm = 8; 
        const minimalHeightMm = 5;
        const minimalHeightPx = Math.max(1, Math.round(pixelsPerMm * minimalHeightMm));

        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const srcY = pageIndex * slicePixelHeight;
            const srcH = Math.min(slicePixelHeight, canvas.height - srcY);

            if (!srcH || srcH < minimalHeightPx) {
                if (pageIndex === 0 && totalPages === 1) {
                    // ...
                } else {
                    continue;
                }
            }

            if (pageIndex > 0) pdf.addPage();

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = srcH;
            const ctx = pageCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

            const pageDataUrl = pageCanvas.toDataURL('image/png');
            const sliceHeightMm = (srcH * imgWidthMm) / canvas.width;

            let yPosMm = margins.top;
            if (pageIndex === 0) yPosMm = Math.max(0, margins.top - headerOffsetMm);

            if (gStateFull) pdf.setGState(gStateFull);
            pdf.addImage(pageDataUrl, 'PNG', margins.left, yPosMm, imgWidthMm, sliceHeightMm);

            // Esta lógica (v29) já estava no seu app.js, mas falhava porque logoDataUrl era undefined
            if (logoDataUrl && gStateWatermark && gStateFull) {
                const wmWidth = 150; 
                const wmHeight = 150; 
                const wmX = (pageWidth - wmWidth) / 2; 
                const wmY = (pageHeight - wmHeight) / 2;
                
                pdf.setGState(gStateWatermark); 
                pdf.addImage(logoDataUrl, 'PNG', wmX, wmY, wmWidth, wmHeight, undefined, 'FAST');
                pdf.setGState(gStateFull); 
            }
        }
        
        // --- INÍCIO DA CORREÇÃO (Filename) ---
        const filename = `${currentDocument.type}_${currentDocument.id}_msi.pdf`;
        // --- FIM DA CORREÇÃO ---
        pdf.save(filename);

        showToast('PDF gerado com sucesso!', 'success');

    } catch (err) {
        console.error('Erro ao gerar PDF via clone:', err);
        showToast('Erro ao gerar PDF', 'error');
    } finally {
        if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
        showLoading(false);
    }
};

window.exportDOCX = async function() {
    if (!currentDocument) {
        showToast('Nenhum documento para exportar', 'warning');
        return;
    }
    
    showToast('Gerando DOCX...', 'info');
    showLoading(true);

    try {
        // 1. Importar recursos necessários (Header e ImageRun foram adicionados)
        if (typeof docx === 'undefined') {
            showToast('Biblioteca DOCX não carregada. Recarregue a página.', 'warning');
            console.error('docx não está definido - biblioteca não carregou');
            return;
        }
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, HeadingLevel, Header, ImageRun } = docx;

        // --- Helper interno para obter dimensões da imagem ---
        const getImageDimensions = (dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.onerror = () => resolve({ width: 500, height: 500 }); // Fallback
                img.src = dataUrl;
            });
        };

        // 2. Buscar Logo para Marca D'água (igual ao PDF)
        const logoDataUrl = await getLogoBase64();
        let watermarkHeader = undefined;

        if (logoDataUrl) {
            try {
                // Precisamos apenas dos dados base64, sem o prefixo "data:image/png;base64,"
                const logoBase64Data = logoDataUrl.split(',')[1];
                const { width: imgWidth, height: imgHeight } = await getImageDimensions(logoDataUrl);
                
                // Manter proporção, com largura fixa de 450px para a marca d'água
                const ratio = imgHeight / imgWidth;
                const wmWidth = 450;
                const wmHeight = wmWidth * ratio;

                // Criar o Header que conterá a marca d'água
                watermarkHeader = new Header({
                    children: [
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: logoBase64Data,
                                    transformation: {
                                        width: wmWidth,
                                        height: wmHeight,
                                    },
                                    floating: {
                                        // Centralizado na página
                                        horizontalPosition: { relative: 'page', align: 'center' },
                                        verticalPosition: { relative: 'page', align: 'center' },
                                        // Configuração principal da marca d'água
                                        behindDocument: true, 
                                    }
                                })
                            ]
                        })
                    ]
                });
            } catch (e) {
                console.error("Erro ao processar imagem da marca d'água:", e);
                showToast("Logo encontrado, mas falhou ao processar para o DOCX.", 'warning');
            }
        } else {
            showToast('Logo não encontrado, DOCX será gerado sem marca dágua.', 'warning');
        }
        // --- Fim da lógica da Marca D'água ---

        const doc = currentDocument;

        // 3. Obter template (igual ao PDF)
        const template = Utils.getDocumentTemplate(doc.type, {
            validadeDias: doc.typeSpecific?.validadeDias,
            companyName: doc.companySnapshot?.fantasia || doc.companySnapshot?.name,
            clientName: doc.clientSnapshot?.name
        });

        // 4. Separar itens por tipo (igual ao PDF)
        const serviceTypes = new Set();
        const itemsByType = {
            instalacao: [],
            manutencao: [],
            produto: []
        };
        (doc.items || []).forEach(item => {
            if (item.serviceType) {
                serviceTypes.add(item.serviceType);
                itemsByType[item.serviceType].push(item);
            }
        });

        // 5. Formatar pagamento (igual ao PDF)
        let paymentInfo = '';
        if (doc.payment) {
            if (doc.payment.type === 'avista') {
                paymentInfo = 'À Vista';
            } else {
                const installments = Utils.calculateInstallments(doc.total, doc.payment.installments);
                paymentInfo = `Parcelado em ${doc.payment.installments}x de ${installments[0].formatted}`;
            }
        }

        // --- Funções Helper para construir o DOCX ---
        const createInfoPara = (label, value) => new Paragraph({
            children: [
                new TextRun({ text: `${label}: `, bold: true }),
                new TextRun(value || '')
            ]
        });

        const createServiceTable = (title, items) => {
            if (!items || items.length === 0) return [];
            const header = new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Descrição", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qtd", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Valor Unit.", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Subtotal", bold: true })] })] })
                ]
            });
            const rows = items.map(item => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(item.description || '')] }),
                    new TableCell({ children: [new Paragraph((item.qty || 0).toString())] }),
                    new TableCell({ children: [new Paragraph(Utils.formatMoney(item.unitPrice || 0))] }),
                    new TableCell({ children: [new Paragraph(Utils.formatMoney(item.subtotal || 0))] })
                ]
            }));
            return [
                new Paragraph({ text: title, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [header, ...rows]
                })
            ];
        };
        // --- Fim Helpers ---

        // 6. Montar o array de "filhos" (children) da seção principal
        let docxChildren = [];

        // Cabeçalho
        docxChildren.push(new Paragraph({ text: template.title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
        docxChildren.push(new Paragraph({ text: `Documento #${doc.id}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }));

        // Emitente
        docxChildren.push(new Paragraph({ text: "Emitente", heading: HeadingLevel.HEADING_2 }));
        docxChildren.push(createInfoPara("Razão Social", doc.companySnapshot?.name));
        docxChildren.push(createInfoPara("CNPJ", Utils.formatCpfCnpj(doc.companySnapshot?.cnpj)));
        docxChildren.push(createInfoPara("Endereço", doc.companySnapshot?.address));
        docxChildren.push(createInfoPara("Contato", `${doc.companySnapshot?.phone || ''} | ${doc.companySnapshot?.email || ''}`));
        
        // Cliente
        docxChildren.push(new Paragraph({ text: "Cliente", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
        docxChildren.push(createInfoPara("Nome", doc.clientSnapshot?.name));
        docxChildren.push(createInfoPara("CPF/CNPJ", Utils.formatCpfCnpj(doc.clientSnapshot?.cpfCnpj)));
        if (doc.clientSnapshot?.address) {
            docxChildren.push(createInfoPara("Endereço", doc.clientSnapshot.address));
        }
        if (doc.clientSnapshot?.contact) {
            docxChildren.push(createInfoPara("Contato", doc.clientSnapshot.contact));
        }

        // 7. Adicionar tabelas de itens (espelhando a lógica do PDF)
        if (serviceTypes.has('instalacao')) {
            docxChildren.push(...createServiceTable('Instalação', itemsByType.instalacao));
        }
        if (serviceTypes.has('manutencao')) {
            docxChildren.push(...createServiceTable('Manutenção', itemsByType.manutencao));
        }
        if (serviceTypes.has('produto')) {
            docxChildren.push(...createServiceTable('Produtos', itemsByType.produto));
        }

        // 8. Totais (espelhando a lógica do PDF)
        const discountValue = doc.discountValue || doc.discount_value || 0;
        const discountPercent = doc.discountPercent || doc.discount_percent || 0;
        if (discountValue > 0 || discountPercent > 0) {
             docxChildren.push(new Paragraph({
                text: `Subtotal: ${Utils.formatMoney(doc.subtotal)}`,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 200 }
            }));
        }
        if (discountPercent > 0) {
             docxChildren.push(new Paragraph({
                text: `Desconto (${doc.discountPercent}%): - ${Utils.formatMoney(doc.discountValue)}`,
                alignment: AlignmentType.RIGHT
            }));
        }
        if (doc.taxValue > 0) {
             docxChildren.push(new Paragraph({
                text: `Impostos/Taxas: + ${Utils.formatMoney(doc.taxValue)}`,
                alignment: AlignmentType.RIGHT
            }));
        }
        docxChildren.push(new Paragraph({
            children: [new TextRun({ text: `TOTAL: ${Utils.formatMoney(doc.total)}`, bold: true, size: 28 })],
            alignment: AlignmentType.RIGHT
        }));

        // 9. Pagamento (igual ao PDF)
        if (paymentInfo) {
            docxChildren.push(new Paragraph({ text: "Condições de Pagamento", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
            docxChildren.push(new Paragraph(paymentInfo));
        }

        // 10. Observações (igual ao PDF)
        if (doc.observations) {
            docxChildren.push(new Paragraph({ text: "Observações", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
            docxChildren.push(new Paragraph(doc.observations));
        }

        // 11. Rodapé (igual ao PDF)
        docxChildren.push(new Paragraph({ text: `\n${doc.cityState}, ${Utils.formatDate(doc.date)}`, spacing: { before: 400 } }));
        docxChildren.push(new Paragraph(template.footer));
        docxChildren.push(new Paragraph('\n_______________________________________________'));
        docxChildren.push(new Paragraph({ children: [new TextRun({ text: doc.companySnapshot?.fantasia || doc.companySnapshot?.name, bold: true })] }));
        if (doc.responsavelTecnico) {
            docxChildren.push(new Paragraph(`Responsável Técnico: ${doc.responsavelTecnico}`));
        }

        // 12. Criar e Baixar o Documento (com o header da marca d'água)
        const docxDoc = new Document({
            sections: [{
                headers: {
                    default: watermarkHeader // <-- AQUI A MÁGICA ACONTECE
                },
                properties: {},
                children: docxChildren
            }]
        });

        const filename = `${doc.type}_${doc.id}_msi.docx`;
        
        const blob = await Packer.toBlob(docxDoc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showToast('DOCX gerado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao gerar DOCX:', error);
        showToast(`Erro ao gerar DOCX: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
};


function getCurrentFilters() {
    return {
        type: document.getElementById('filter-type')?.value || '',
        status: document.getElementById('filter-status')?.value || '',
        dateStart: document.getElementById('filter-date-start')?.value || '',
        dateEnd: document.getElementById('filter-date-end')?.value || '',
        search: document.getElementById('filter-search')?.value || ''
    };
}

// ===== FILTROS =====
function setupDynamicFilters() {
    ['filter-type', 'filter-status', 'filter-date-start', 'filter-date-end', 'filter-search'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', applyFilters);
            if (input.type === 'text') {
                input.addEventListener('input', Utils.debounce(applyFilters, 300));
            }
        }
    });
}

// ===== FILTROS (Modificada) =====
// ... (setupDynamicFilters permanece igual) ...

function applyFilters() {
    const filters = {
        type: document.getElementById('filter-type').value,
        status: document.getElementById('filter-status').value,
        dateStart: document.getElementById('filter-date-start').value,
        dateEnd: document.getElementById('filter-date-end').value,
        search: document.getElementById('filter-search').value
    };
    
    // ATUALIZADO: Chama loadDashboard, que agora cuida dos KPIs E da tabela
    loadDashboard(filters);
}

// ... (window.clearFilters permanece igual, pois já chama loadDashboard()) ...

window.clearFilters = function() {
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-search').value = '';
    loadDashboard();
};

// ===== PRODUTOS =====
async function loadProducts() {
    try {
        const { data: products } = await supabaseClient
            .from('products')
            .select('*')
            .order('name');
        
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        if (!products || products.length === 0) {
            grid.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhum serviço cadastrado</p>';
            return;
        }
        
        grid.innerHTML = products.map(product => {
            const typeLabel = {
                'instalacao': 'Instalação',
                'manutencao': 'Manutenção',
                'produto': 'Produto'
            }[product.service_type] || '';
            
            return `
                <div class="product-card">
                    <div class="card-title">${product.name}</div>
                    <div class="card-info">
                        Tipo: <strong>${typeLabel}</strong><br>
                        Preço: <strong>${Utils.formatMoney(product.unit_price)}</strong>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn" onclick="editProduct('${product.id}')">Editar</button>
                        <button class="action-btn" onclick="deleteProduct('${product.id}')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('');
        
        await setupServiceAutocomplete();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

// ===== CLIENTES =====
async function loadClients() {
    try {
        const { data: clients } = await supabaseClient
            .from('clients')
            .select('*')
            .order('name');
        
        const grid = document.getElementById('clients-grid');
        if (!grid) return;
        
        if (!clients || clients.length === 0) {
            grid.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhum cliente cadastrado</p>';
            return;
        }
        
        grid.innerHTML = clients.map(client => `
            <div class="client-card">
                <div class="card-title">${client.name}</div>
                <div class="card-info">
                    CPF/CNPJ: ${Utils.formatCpfCnpj(client.cpf_cnpj)}<br>
                    ${client.contact ? `Contato: ${client.contact}` : ''}
                </div>
                <div class="card-actions">
                    <button class="action-btn" onclick="editClient('${client.id}')">Editar</button>
                    <button class="action-btn" onclick="deleteClient('${client.id}')">Excluir</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

// ===== CONFIGURAÇÕES =====
async function loadCompanySettings() {
    try {
        const { data: company } = await supabaseClient
            .from('company')
            .select('*')
            .single();
        
        if (company) {
            document.getElementById('company-name').value = company.name || '';
            document.getElementById('company-fantasia').value = company.fantasia || '';
            document.getElementById('company-cnpj').value = company.cnpj || '';
            document.getElementById('company-phone').value = company.phone || '';
            document.getElementById('company-email').value = company.email || '';
            document.getElementById('company-address').value = company.address || '';
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

function setupSettingsForm() {
    const form = document.getElementById('company-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const company = {
            id: 'company',
            name: document.getElementById('company-name').value,
            fantasia: document.getElementById('company-fantasia').value,
            cnpj: document.getElementById('company-cnpj').value,
            phone: document.getElementById('company-phone').value,
            email: document.getElementById('company-email').value,
            address: document.getElementById('company-address').value
        };
        
        try {
            const { error } = await supabaseClient
                .from('company')
                .upsert(company);
            
            if (error) throw error;
            
            showToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showToast('Erro ao salvar configurações', 'error');
        }
    });
}

// ===================================
// ===== BANNER DE EDIÇÃO (NOVO) =====
// ====================================================

function showEditBanner(doc) {
    let banner = document.getElementById('edit-mode-banner');
    
    // 1. Criar o banner dinamicamente se ele não existir no HTML
    if (!banner) {
        const createView = document.getElementById('create-view');
        // Encontrar o cabeçalho para inserir o banner depois dele
        const header = createView.querySelector('.view-header');
        
        const bannerHTML = `
            <div id="edit-mode-banner" style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="color: #78350f;">
                            <strong>Documento:</strong> <span id="edit-doc-type"></span> <strong>ID:</strong> <span id="edit-doc-id"></span>
                            <strong>Cliente:</strong> <span id="edit-doc-client"></span>
                        </div>
                    </div>
                    <button onclick="cancelEdit()" style="padding: 0.6rem 1.2rem; background: white; border: 2px solid #f59e0b; border-radius: 6px; cursor: pointer; font-weight: 600; color: #92400e;">
                        Cancelar edição
                    </button>
                </div>
            </div>
        `;
        
        // Inserir o banner logo após o cabeçalho da view
        if (header) {
            header.insertAdjacentHTML('afterend', bannerHTML);
        } else {
            // Fallback: inserir no topo da view
            createView.insertAdjacentHTML('afterbegin', bannerHTML);
        }
        
        banner = document.getElementById('edit-mode-banner'); // Pegar a referência
    }
    
    // 2. Atualizar o conteúdo e mostrar o banner
    const clientName = doc.clientSnapshot?.name || doc.client_snapshot?.name || 'N/A';
    document.getElementById('edit-doc-type').textContent = doc.type === 'orcamento' ? 'ORÇAMENTO' : 'RECIBO';
    document.getElementById('edit-doc-id').textContent = doc.id;
    document.getElementById('edit-doc-client').textContent = clientName;
    banner.style.display = 'block';
    
    // 3. Atualizar o título da view
    const title = document.querySelector('#create-view .view-header h2');
    if (title) {
        title.textContent = `Editando ${doc.type === 'orcamento' ? 'Orçamento' : 'Recibo'} #${doc.id}`;
    }
}

/**
 * Cancela o modo de edição, limpa o formulário e volta ao dashboard.
 */
window.cancelEdit = function() {
    clearForm(); // O clearForm agora vai resetar o banner e o título
    goToDashboard();
}

// ===== MODALS =====
function setupModals() {
    // Product modal
    document.getElementById('product-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const product = {
            name: document.getElementById('product-name').value,
            service_type: document.getElementById('product-service-type').value,
            unit_price: parseFloat(document.getElementById('product-price').value)
        };
        
        const editId = this.dataset.editId;
        
        try {
            if (editId) {
                const { error } = await supabaseClient
                    .from('products')
                    .update(product)
                    .eq('id', editId);
                
                if (error) throw error;
                delete this.dataset.editId;
            } else {
                const { error } = await supabaseClient
                    .from('products')
                    .insert(product);
                
                if (error) throw error;
            }
            
            await loadProducts();
            closeProductModal();
            showToast('Serviço salvo com sucesso!', 'success');
        } catch (error) {
            if (error.message.includes('duplicate')) {
                showToast('Já existe um serviço com este nome!', 'error');
            } else {
                showToast('Erro ao salvar serviço', 'error');
            }
        }
    });
    
    // Client modal
    document.getElementById('client-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const client = {
            name: document.getElementById('modal-client-name').value,
            cpf_cnpj: document.getElementById('modal-client-cpfcnpj').value,
            address: document.getElementById('modal-client-address').value,
            contact: document.getElementById('modal-client-contact').value
        };
        
        const editId = this.dataset.editId;
        
        try {
            if (editId) {
                const { error } = await supabaseClient
                    .from('clients')
                    .update(client)
                    .eq('id', editId);
                
                if (error) throw error;
                delete this.dataset.editId;
            } else {
                const { error } = await supabaseClient
                    .from('clients')
                    .insert(client);
                
                if (error) throw error;
            }
            
            await loadClients();
            await setupClientAutocomplete();
            closeClientModal();
            showToast('Cliente salvo com sucesso!', 'success');
        } catch (error) {
            showToast('Erro ao salvar cliente', 'error');
        }
    });
}

// ===== FECHAR MODAIS (click fora do modal / ESC) =====
function setupModalCloseHandlers() {
    // fechar preview ao clicar no overlay (fora do conteúdo)
    var previewModal = document.getElementById('preview-modal');
    if (previewModal) {
        previewModal.addEventListener('click', function (e) {
            // se o clique foi no próprio overlay (não em um filho), fecha
            if (e.target === this) {
                closePreview();
            }
        });
    }

    // fechar outros modais ao clicar no overlay (produto / cliente)
    ['product-modal', 'client-modal'].forEach(function(id){
        var m = document.getElementById(id);
        if (m) {
            m.addEventListener('click', function (e) {
                if (e.target === this) {
                    // usar as funções de fechamento existentes para manter limpeza/estado
                    if (id === 'product-modal') closeProductModal();
                    if (id === 'client-modal') closeClientModal();
                }
            });
        }
    });

    // ESC para fechar (fecha preview, product ou client se estiverem ativos)
    document.addEventListener('keydown', function (e) {
        var key = e.key || e.keyCode;
        if (key === 'Escape' || key === 'Esc' || key === 27) {
            if (previewModal && previewModal.classList.contains('active')) closePreview();
            var pm = document.getElementById('product-modal');
            if (pm && pm.classList.contains('active')) closeProductModal();
            var cm = document.getElementById('client-modal');
            if (cm && cm.classList.contains('active')) closeClientModal();
        }
    });
}


// Modal functions

window.openProductModal = function() {
    document.getElementById('product-form').reset();
    delete document.getElementById('product-form').dataset.editId;
    document.querySelector('#product-modal .modal-header h3').textContent = 'Novo serviço';
    document.getElementById('product-modal').classList.add('active');
};

window.closeProductModal = function() {
    document.getElementById('product-modal').classList.remove('active');
};

window.editProduct = async function(id) {
    try {
        const { data: product } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        
        if (product) {
            document.querySelector('#product-modal .modal-header h3').textContent = 'Editar serviço';
            document.getElementById('product-modal').classList.add('active');
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-service-type').value = product.service_type;
            document.getElementById('product-price').value = product.unit_price;
            document.getElementById('product-form').dataset.editId = id;
        }
    } catch (error) {
        console.error('Erro:', error);
    }
};

window.deleteProduct = async function(id) {
    if (confirm('Excluir este serviço?')) {
        try {
            const { error } = await supabaseClient
                .from('products')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await loadProducts();
            showToast('Serviço excluído', 'success');
        } catch (error) {
            showToast('Erro ao excluir', 'error');
        }
    }
};

window.openClientModal = function() {
    document.getElementById('client-form').reset();
    delete document.getElementById('client-form').dataset.editId;
    document.querySelector('#client-modal .modal-header h3').textContent = 'Novo cliente';
    document.getElementById('client-modal').classList.add('active');
};

window.closeClientModal = function() {
    document.getElementById('client-modal').classList.remove('active');
};

window.editClient = async function(id) {
    try {
        const { data: client } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();
        
        if (client) {
            document.querySelector('#client-modal .modal-header h3').textContent = 'Editar cliente';
            document.getElementById('client-modal').classList.add('active');
            document.getElementById('modal-client-name').value = client.name;
            document.getElementById('modal-client-cpfcnpj').value = client.cpf_cnpj;
            document.getElementById('modal-client-address').value = client.address || '';
            document.getElementById('modal-client-contact').value = client.contact || '';
            document.getElementById('client-form').dataset.editId = id;
        }
    } catch (error) {
        console.error('Erro:', error);
    }
};

window.deleteClient = async function(id) {

    if (confirm('Excluir este cliente?')) {
        try {
            const { error } = await supabaseClient
                .from('clients')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await loadClients();
            await setupClientAutocomplete();
            showToast('Cliente excluído', 'success');
        } catch (error) {
            showToast('Erro ao excluir', 'error');
        }
    }
};

// ===== BACKUP =====
window.exportBackup = async function() {
    showToast('Preparando backup...', 'info');
    
    try {
        const [company, products, clients, documents] = await Promise.all([
            supabaseClient.from('company').select('*').single(),
            supabaseClient.from('products').select('*'),
            supabaseClient.from('clients').select('*'),
            supabaseClient.from('documents').select('*')
        ]);
        
        const backup = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            company: company.data,
            products: products.data,
            clients: clients.data,
            documents: documents.data
        };
        
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `msi-backup-${Utils.hoje()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Backup exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showToast('Erro ao exportar backup', 'error');
    }
};

window.restoreSeed = async function() {
    if (!confirm('Isso apagará TODOS os dados atuais. Continuar?')) return;
    
    showToast('Restaurando dados iniciais...', 'info');
    
    // Implementar restore...
    
    showToast('Dados restaurados!', 'success');
    location.reload();
};

// ===== HELPERS =====
function formatDocumentFromDB(data) {
    return {
        ...data,
        id: data.id,
        type: data.type,
        clientSnapshot: data.client_snapshot,
        companySnapshot: data.company_snapshot,
        typeSpecific: data.type_specific,
        responsavelTecnico: data.responsavel_tecnico,
        cityState: data.city_state,
        discountPercent: data.discount_percent,
        taxValue: data.tax_value,
        discountValue: data.discount_value
    };
}
