# Fatal Notifications

Aplicativo desktop que monitora o TeamSpeak 3 para mensagens de bot e envia notificações push via Pushbullet.

## Funcionalidades

- 🔔 **Alertas em Tempo Real**: Seja notificado instantaneamente quando o BB-Bot enviar mensagens
- 📱 **Integração com Pushbullet**: Receba notificações no seu celular
- 🎨 **Interface Moderna**: Tema escuro inspirado no Discord
- 🔄 **Atualização Automática**: Verifica e instala atualizações automaticamente
- 💾 **Configurações Persistentes**: Suas chaves de API são salvas localmente

## Download

Baixe o último `.exe` em [Releases](https://github.com/luciano-infanti/Fatal-Notifications/releases).

---

## 📖 Tutorial de Configuração

### 🔑 Como obter a Chave API do TeamSpeak 3

1. **Abra o TeamSpeak 3** no seu computador

2. **Acesse as configurações**:
   - Clique em `Ferramentas` (Tools) no menu superior
   - Selecione `Opções` (Options)

3. **Navegue até Addons**:
   - No menu lateral esquerdo, clique em `Addons`

4. **Ative o ClientQuery**:
   - Procure por `ClientQuery` na lista de plugins
   - Certifique-se de que está **ativado** (checkbox marcado)

5. **Copie a API Key**:
   - Clique em `ClientQuery` para selecioná-lo
   - Clique no botão `Configurações` ou `Settings`
   - Você verá a **API Key** - copie esse código
   - O formato é algo como: `XXXX-XXXX-XXXX-XXXX-XXXX`

6. **Cole no Fatal Notifications**:
   - Abra o Fatal Notifications
   - Cole a chave no campo "Chave API TS3"

> ⚠️ **Importante**: O TeamSpeak 3 precisa estar aberto e conectado ao servidor para o monitoramento funcionar!

---

### 📱 Como obter a Chave API do Pushbullet

1. **Crie uma conta no Pushbullet**:
   - Acesse [pushbullet.com](https://www.pushbullet.com/)
   - Clique em `Sign Up` (Criar conta)
   - Você pode criar conta com Google ou Facebook

2. **Instale o app no celular**:
   - **Android**: Baixe o [Pushbullet na Play Store](https://play.google.com/store/apps/details?id=com.pushbullet.android)
   - **iPhone**: Baixe o [Pushbullet na App Store](https://apps.apple.com/app/pushbullet/id810352052)
   - Faça login com a mesma conta

3. **Obtenha o Access Token**:
   - No computador, acesse [pushbullet.com/#settings/account](https://www.pushbullet.com/#settings/account)
   - Role até a seção **Access Tokens**
   - Clique em `Create Access Token`
   - Copie o token gerado (é uma string longa)

4. **Cole no Fatal Notifications**:
   - Cole o token no campo "Chave API Pushbullet"
   - Clique em `Salvar`

> 💡 **Dica**: O Pushbullet é gratuito com limite de 500 notificações por mês. Para uso normal, isso é mais que suficiente!

---

### ▶️ Iniciando o Monitoramento

1. Certifique-se de que o **TeamSpeak 3 está aberto** e conectado ao servidor
2. Preencha ambas as chaves de API
3. Clique em **Salvar**
4. Clique em **Iniciar**
5. Pronto! Você receberá notificações no celular 📱

---

## 🔔 Filtros de Notificação

| Filtro | Descrição |
|--------|-----------|
| **Next** | Pokes contendo "chegou sua vez no respawn" |
| **Pokes diversos** | Todas as outras mensagens de poke |
| **Hunted upou** | Level up de jogadores na lista de Hunted |
| **Friend upou** | Level up de jogadores na lista de Friend |
| **Hunted morreu** | Morte de jogadores na lista de Hunted |
| **Friend morreu** | Morte de jogadores na lista de Friend |

---

## 🔒 Segurança e Privacidade

### ✅ Software de Código Aberto

Este software é **100% open source** (código aberto). Isso significa que:

- 📖 **Transparência Total**: Todo o código-fonte está disponível neste repositório para qualquer pessoa verificar
- 🔍 **Auditável**: Você pode ler exatamente o que o programa faz - não há código oculto ou funcionalidades secretas
- 🤝 **Comunidade**: Qualquer desenvolvedor pode revisar, sugerir melhorias ou reportar problemas

### 🔐 Suas Chaves de API são Seguras

- **Armazenamento Local**: Suas chaves de API são salvas **apenas no seu computador**, na pasta AppData do seu usuário
- **Nunca Enviadas**: As chaves **nunca são enviadas** para nenhum servidor externo além do Pushbullet (para enviar suas notificações)
- **Não Incluídas no Build**: Quando você compila ou atualiza o app, suas chaves permanecem salvas e privadas

### 🛡️ O que o Software Faz (e NÃO Faz)

| ✅ O que FAZ | ❌ O que NÃO faz |
|-------------|-----------------|
| Conecta ao TeamSpeak 3 local (127.0.0.1) | Não acessa servidores externos do TS3 |
| Envia notificações via Pushbullet | Não coleta dados pessoais |
| Salva configurações localmente | Não envia suas chaves para terceiros |
| Verifica atualizações no GitHub | Não instala software adicional |

### 📍 Onde Seus Dados São Armazenados

```
C:\Users\{SeuUsuário}\AppData\Roaming\fatal-notifications\settings.json
```

Este arquivo contém apenas suas chaves de API e preferências de filtro. Você pode deletá-lo a qualquer momento para "resetar" o aplicativo.

### 🔓 Licença MIT

Este projeto usa a licença MIT - uma das licenças mais permissivas. Você pode usar, modificar e distribuir livremente.

---

## 🛠️ Compilando do Código-Fonte

Se preferir compilar você mesmo (em vez de baixar o .exe pronto):

```bash
# Clone o repositório
git clone https://github.com/luciano-infanti/Fatal-Notifications.git
cd Fatal-Notifications

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm start

# Ou compile o instalador
npm run build
```

---

## 📄 Licença

MIT - Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
