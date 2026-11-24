// Máscaras e validações
        const celularInput = document.getElementById('celular');
        celularInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 20) value = value.slice(0, 20);
            
            if (value.length >= 3) {
                value = '+258 ' + value.slice(3);
            }
            if (value.length > 8) {
                value = value.slice(0, 8) + ' ' + value.slice(8);
            }
            if (value.length > 13) {
                value = value.slice(0, 13) + ' ' + value.slice(13);
            }
            e.target.value = value;
        });

        // Progress bar
        function updateProgress() {
            const form = document.getElementById('cadastroForm');
            const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
            
            let filled = 0;
            let total = inputs.length;
            
            inputs.forEach(input => {
                if (input.type === 'radio') {
                    const name = input.name;
                    if (form.querySelector(`input[name="${name}"]:checked`)) filled++;
                } else if (input.type === 'checkbox') {
                    if (input.checked) filled++;
                } else {
                    if (input.value.trim()) filled++;
                }
            });
            
            const percent = Math.round((filled / total) * 100);
            document.getElementById('progressFill').style.width = percent + '%';
            document.getElementById('progressText').textContent = percent + '%';
        }

        document.getElementById('cadastroForm').addEventListener('input', updateProgress);
        document.getElementById('cadastroForm').addEventListener('change', updateProgress);

        // Validação em tempo real
        document.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', function() {
                validateField(this);
            });
        });

        function validateField(field) {
            const errorMsg = field.parentElement.querySelector('.error-msg');
            let isValid = true;
            
            if (field.hasAttribute('required') && !field.value.trim()) {
                isValid = false;
            }
            
            if (field.type === 'email' && field.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                isValid = emailRegex.test(field.value);
            }
            
            if (!isValid && field.hasAttribute('required')) {
                field.classList.add('error');
                if (errorMsg) errorMsg.classList.add('show');
            } else {
                field.classList.remove('error');
                if (errorMsg) errorMsg.classList.remove('show');
            }
            
            return isValid;
        }

        // Submit - REMOVIDO (consolidado no listener de backend abaixo)

        function closeModal() {
            document.getElementById('successModal').classList.remove('show');
        }

        // Fechar modal ao clicar fora
        document.getElementById('successModal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // Inicializar progresso
        updateProgress();

        // ========================================
        // INTEGRAÇÃO COM BACKEND
        // ========================================

        // Detectar ambiente e usar o endpoint correto em desktop e celular
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Em produção, defina window.__API_BASE_URL__ em js/config.js com o URL
        // público do Web Service AJOV no Render. Não usar Netlify Functions como backend alternativo.
        const API_BASE_URL = ((isLocal ? 'http://localhost:3000' : window.__API_BASE_URL__) ||
            'https://SUBSTITUIR-PELO-BACKEND-AJOV.onrender.com').replace(/\/$/, '');

        async function fazerRequisicao(endpoint, metodo = 'GET', dados = null) {
            try {
                const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
                const opcoes = {
                    method: metodo,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                if (dados) {
                    opcoes.body = JSON.stringify(dados);
                }

                const response = await fetch(url, opcoes);
                const contentType = response.headers.get('content-type') || '';
                const rawBody = await response.text();
                let resultado = {};

                if (rawBody) {
                    try {
                        resultado = JSON.parse(rawBody);
                    } catch (erro) {
                        resultado = { raw: rawBody };
                    }
                }

                return {
                    sucesso: response.ok,
                    status: response.status,
                    dados: resultado,
                    contentType
                };
            } catch (erro) {
                console.error('Erro na requisição:', erro);
                return {
                    sucesso: false,
                    status: 500,
                    erro: erro.message
                };
            }
        }

        function formularioParaJSON(formElement) {
            const formData = new FormData(formElement);
            const json = {};

            for (let [chave, valor] of formData.entries()) {
                if (chave === 'documentos') {
                    if (!json.documentos) {
                        json.documentos = [];
                    }
                    json.documentos.push(valor);
                } else if (chave === 'aceiteDeclaracao') {
                    json[chave] = true;
                } else {
                    json[chave] = valor || null;
                }
            }

            return json;
        }

        function mostrarMensagemBackend(titulo, mensagem, tipo = 'sucesso') {
            const modal = document.getElementById('successModal');
            if (modal) {
                const modalContent = modal.querySelector('.modal-content');
                const icon = modalContent.querySelector('.modal-icon');
                const h2 = modalContent.querySelector('h2');
                const p = modalContent.querySelector('p');

                if (tipo === 'sucesso') {
                    icon.innerHTML = '<i class="fas fa-check"></i>';
                    icon.parentElement.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)';
                    h2.style.color = 'var(--primary)';
                } else {
                    icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                    icon.parentElement.style.background = 'linear-gradient(135deg, #e89c0a 0%, #d47a06 100%)';
                    h2.style.color = '#e89c0a';
                }

                h2.textContent = titulo;
                p.textContent = mensagem;
                modal.classList.add('show');
            }
        }

        // Integrar submit com backend - com validação correta
        let tentativasEnvio = 0;

        document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            // Limpar erros anteriores
            document.querySelectorAll('.error-msg').forEach(msg => msg.classList.remove('show'));
            document.querySelectorAll('input, select, textarea').forEach(field => field.classList.remove('error'));

            let isValid = true;
            let camposComErro = [];

            // Validar todos os campos obrigatórios
            document.querySelectorAll('[required]').forEach(field => {
                if (field.type === 'radio') {
                    // Validar grupo de radio buttons
                    const name = field.name;
                    if (!document.querySelector(`input[name="${name}"]:checked`)) {
                        isValid = false;
                        if (!camposComErro.includes(name)) {
                            camposComErro.push(name);
                            const errorMsg = field.closest('.form-group').querySelector('.error-msg');
                            if (errorMsg) errorMsg.classList.add('show');
                        }
                    }
                } else if (field.type === 'checkbox' && field.id === 'aceiteDeclaracao') {
                    // Validar checkbox de declaração
                    if (!field.checked) {
                        isValid = false;
                        field.closest('.checkbox-declare').style.borderColor = '#c0392b';
                    } else {
                        field.closest('.checkbox-declare').style.borderColor = 'var(--primary-light)';
                    }
                } else {
                    // Validar outros campos
                    if (!validateField(field)) {
                        isValid = false;
                    }
                }
            });

            // Mostrar mensagem de erro se não validou
            if (!isValid) {
                const firstError = document.querySelector('.error');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                mostrarMensagemBackend('⚠️ Validação', 'Por favor, preencha todos os campos obrigatórios corretamente.', 'erro');
                return;
            }

            const btnSubmit = document.getElementById('btnSubmit');
            const textOriginal = btnSubmit.innerHTML;
            btnSubmit.disabled = true;

            try {
                const dados = formularioParaJSON(this);
                
                // Verificar dados antes de enviar
                console.log('📤 Enviando cadastro para:', API_BASE_URL + '/api/cadastro/criar');

                // Validação extra no frontend
                const camposObrigatorios = ['nomeCompleto', 'nomeMae', 'numeroIdentificacao', 'celular', 'dataNascimento', 'sexo', 'estadoCivil', 'nacionalidade', 'naturalidade'];
                const camposFaltando = camposObrigatorios.filter(c => !dados[c] || dados[c] === '' || dados[c] === null);
                
                if (camposFaltando.length > 0) {
                    console.warn('⚠️ Campos faltando:', camposFaltando);
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = textOriginal;
                    mostrarMensagemBackend('⚠️ Campos Incompletos', `Faltam preencher: ${camposFaltando.join(', ')}`, 'erro');
                    return;
                }

                // Mostrar loading
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

                const resultado = await fazerRequisicao('/api/cadastro/criar', 'POST', dados);

                console.log('📥 Resposta recebida:', resultado);

                btnSubmit.disabled = false;
                btnSubmit.innerHTML = textOriginal;

                if (resultado.sucesso) {
                    console.log('✅ Cadastro enviado com sucesso!');
                    const avisoEmail = resultado.dados?.emailAdminEnviado === false
                        ? '\n\nAtenção: o cadastro foi guardado, mas a notificação por email não foi enviada. A equipa técnica deverá verificar o serviço de email.'
                        : '';
                    mostrarMensagemBackend(
                        resultado.dados?.emailAdminEnviado === false ? 'Cadastro Guardado' : '🎉 Cadastro Enviado!',
                        `Obrigado ${dados.nomeCompleto}! Seu cadastro foi recebido com sucesso.\n\nAnalisaremos sua inscrição e entraremos em contato.${avisoEmail}`,
                        resultado.dados?.emailAdminEnviado === false ? 'erro' : 'sucesso'
                    );
                    this.reset();
                    updateProgress();
                } else {
                    console.error('❌ Erro na resposta:', resultado.dados);
                    let mensagemErro = resultado.dados?.error || resultado.dados?.erro || resultado.dados?.mensagem || 'Erro ao enviar cadastro.';
                    const detalhes = resultado.dados?.detalhes;
                    
                    // Se há detalhes da validação, mostrar
                    if (Array.isArray(detalhes) && detalhes.length > 0) {
                        console.error('Erros de validação:', detalhes);
                        mensagemErro = detalhes.join('\n• ');
                    }
                    
                    // Se o número de identificação já existe
                    if (mensagemErro.includes('já está cadastrado')) {
                        mensagemErro = 'Este número de identificação já foi cadastrado em nosso sistema.\n\nSe acredita que é um erro, entre em contato conosco.';
                    }
                    
                    mostrarMensagemBackend('❌ Erro ao Enviar', mensagemErro, 'erro');
                }

            } catch (error) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = textOriginal;
                console.error('💥 Erro na requisição:', error);
                mostrarMensagemBackend(
                    '⚠️ Erro de Conexão',
                    'Não foi possível conectar ao servidor.\n\n1. Verifique se o backend está rodando\n2. Verifique sua conexão com a internet\n3. Tente novamente em alguns segundos',
                    'erro'
                );
            }
        });

        // Verificar conexão com servidor na página carregar
        window.addEventListener('load', async function() {
            try {
                const resultado = await fazerRequisicao('/api/health', 'GET');
                if (resultado.sucesso) {
                    console.log('✅ Conectado ao servidor com sucesso!');
                } else {
                    console.warn('⚠️ Servidor respondeu com erro');
                }
            } catch (error) {
                console.warn('⚠️ Servidor não está acessível. O formulário pode não funcionar.');
            }
        });

        console.log('✅ Backend integrado. Enviando para:', API_BASE_URL);
