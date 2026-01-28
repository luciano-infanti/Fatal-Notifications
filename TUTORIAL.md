# 🔔 Guia Definitivo: Fatal Notifications
## Tudo o que você precisa para configurar e nunca mais perder um boss!

---

## 📚 Índice
1. [Introdução: O que é isso?](#capítulo-1-introdução)
2. [Passo 1: Download e Instalação](#capítulo-2-download)
3. [Passo 2: Preparando o TeamSpeak 3 (Muito Importante!)](#capítulo-3-teamspeak)
4. [Passo 3: Configurando o Pushbullet (Notificações no Celular)](#capítulo-4-pushbullet)
5. [Passo 4: Configurando o Fatal Notifications](#capítulo-5-configuração-final)
6. [Dicas de Ouro e Solução de Problemas](#capítulo-6-dicas)

---

## <a name="capítulo-1-introdução"></a>Capítulo 1: O que é isso?
O **Fatal Notifications** fica de olho no chat do seu TeamSpeak 3 enquanto você faz outras coisas (ou dorme!). Ele é perfeito para quem não quer perder a vez no Respawn. Quando o BB-Bot Tibia avisa que você foi pokeado, o programa captura essa mensagem e envia **imediatamente** para o seu celular.

## <a name="capítulo-2-download"></a>Capítulo 2: Download e Instalação
Primeiro, vamos colocar a ferramenta no seu computador. Ela foi desenvolvida pelo guild member, Even Worse. Questões  referentes à segurança da aplicação podem ser encontradas na seção Segurança e Privacidade clicando [aqui](https://github.com/luciano-infanti/Fatal-Notifications).

1. **Onde baixar?**
   * Acesse a página oficial de lançamentos (Releases): [Clique Aqui para Baixar](https://github.com/luciano-infanti/Fatal-Notifications/releases)
   * Procure pelo arquivo que termina em `.exe` (exemplo: `Fatal-Notifications-Setup-1.0.6.exe`).
   * Clique nele para baixar.

2. **Como instalar?**
   * É o padrão clássico: Clique duas vezes no arquivo baixado.
   * Se aparecer um aviso do Windows ("Windows protegeu o computador"), clique em "Mais informações" e depois em "Executar assim mesmo". (Isso acontece porque o aplicativo é novo e privado).
   * Aguarde a instalação terminar e o ícone aparecer na sua área de trabalho.

---

## <a name="capítulo-3-teamspeak"></a>Capítulo 3: Preparando o TeamSpeak 3 (Muito Importante!)
Aqui está o segredo para tudo funcionar. O TeamSpeak tem uma função oculta que permite que outros programas "leiam" o que acontece nele. Precisamos ativar isso.

⚠️ **REGRA DE OURO**: O **TeamSpeak 3 PRECISA ESTAR ABERTO** para o Fatal Notifications funcionar. Se você fechar o TS, o programa para de ver as mensagens!

### Passo a Passo no TeamSpeak:
1. Abra o seu **TeamSpeak 3** e conecte-se ao servidor da guild.
2. No menu lá em cima, clique em **Ferramentas** (ou *Tools*).
3. Clique em **Opções** (ou *Options*).
   * *[Dica: Você pode apertar Alt + P]*
4. Uma janela vai abrir. No menu lateral esquerdo, clique em **Addons** (ou Suplementos).
5. Na lista que aparecer, procure por **"ClientQuery"**.
   * Se não achar, verifique se está na aba "Plugins" ou "Browse all".
6. **Certifique-se de que a caixinha ao lado de "ClientQuery" está MARCADA (Ativada).**
7. Agora, clique em cima do nome **"ClientQuery"** para selecioná-lo e depois clique no botão **Configurações** (ou *Settings*) que fica embaixo da lista.
8. Uma janelinha preta vai abrir. Você verá algo escrito "API Key".
   * **COPIE ESSE CÓDIGO!** (É uma sequência de letras e números parecida com `BTWL-RFFV-KZPI...`).
   * Salve esse código num bloco de notas por enquanto.
> 🔒 **SEGURANÇA:** Trate esta chave como uma senha. **Nunca a compartilhe com ninguém**, pois ela permite que aplicativos externos se comuniquem diretamente com o seu TeamSpeak.

---

## <a name="capítulo-4-pushbullet"></a>Capítulo 4: Configurando o Pushbullet (Notificações no Celular)
O Pushbullet é o "carteiro" que vai levar a mensagem do seu PC para o seu celular.

1. **Crie sua conta:**
   * Vá para [pushbullet.com](https://www.pushbullet.com/).
   * Clique em "Sign Up" e entre com sua conta do Google ou Facebook.

2. **Instale no Celular:**
   * Vá na loja de aplicativos do seu celular (Play Store ou App Store/iOS).
   * Baixe o app **Pushbullet**.
   * Abra o app e faça login com a **MESMA CONTA** que você criou no site.

3. **Pegue a Chave Secreta (Token):**
   * Volte para o PC, no site do Pushbullet.
   * Clique em **Settings** (Configurações) -> **Account** (Conta).
   * Role a página para baixo até achar a seção **"Access Tokens"**.
   * Clique no botão vermelho **"Create Access Token"**.
   * Um código grande e estranho vai aparecer (exemplo: `o.Pz8s...`).
   * **COPIE ESSE CÓDIGO!** 
> 🔒 **SEGURANÇA:** Trate esta chave como uma senha. **Nunca a compartilhe com ninguém**, pois ela permite que aplicativos externos se comuniquem diretamente com o seu celular.
---

## <a name="capítulo-5-configuração-final"></a>Capítulo 5: Configurando o Fatal Notifications
Agora vamos juntar tudo!

1. Abra o **Fatal Notifications** no seu computador.
2. Você verá dois campos pedindo as chaves que pegamos:
   * **Chave API TS3**: Cole aqui aquele código do TeamSpeak (ClientQuery).
   * **Chave API Pushbullet**: Cole aqui o código grande do site do Pushbullet.
3. Marque as opções que você quer monitorar (recomendamos deixar tudo marcado por enquanto).
4. Clique no botão **SALVAR**.
5. Se tudo estiver certo, clique em **INICIAR**.

✅ **Pronto!** Se aparecer "Monitorando...", você já está seguro.

---

## <a name="capítulo-6-dicas"></a>Capítulo 6: Dicas de Ouro

* **TS3 ABERTO SEMPRE**: Se o TS fechar, o monitoramento cai.
* **Teste sua configuração**: Peça para um amigo te dar um "Poke" no TS. Se seu celular vibrar, está funcionando perfeitamente!
* **A aplicação minimiza**: Você pode fechar a janela do Fatal Notifications que ele vai ficar rodando escondidinho no canto do relógio (bandeja do sistema).
* **O aplicativo Bulletpush não precisa estar aberto**: Você pode fechar o Bulletpush que mesmo assim, você vai receber suas notificações.
* **Configure as notificações no seu celular**: Você pode configurar as notificações do Bulletpush no seu celular para que ele faça barulho e/ou apenas vibre. Alguns players colocam sons diferentes das notificações do celular para que eles saibam que a notificação é do Fatal Notifications.
* **Resetando**: Se precisar trocar as chaves ou se algo der errado, você pode apagar o arquivo de configurações manualmente aqui:
  `%AppData%\Roaming\fatal-notifications\settings.json`

---
*Divirta-se e bom hunt!* 🕷️🐉
