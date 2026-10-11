# Estufa Inteligente

Trabalho de Distribuição de Processos e Dados (UFC): sistema distribuído de
monitoramento e controle de estufas agrícolas, com Gateway central, fontes de
dados simuladas e Cliente com interface web.

| Parte | Linguagem | Pasta |
| --- | --- | --- |
| Gateway (coleta, controle, persistência, consultas) | Python | `gateway/` |
| 6 tipos de fonte simulada (3 controláveis, 3 contínuas) | Python | `fontes/` |
| Cliente de linha de comando (testes e plano B) | Python | `cli/` |
| Cliente principal: TCP com o Gateway + API REST | Java (Spring Boot) | `backend/` |
| Interface web com gráficos | TypeScript (Angular) | `frontend/` |
| Contrato de todas as mensagens e do serviço gRPC | Protocol Buffers | `proto/estufa.proto` |

## Arquitetura

```text
 Navegador (Angular :4200) ──REST/JSON──> Backend Java (:8080) ──TCP 7000, Protobuf──> Gateway Python
                                                                                         │   │   ▲
                                         multicast 239.10.10.10:5007 (descoberta) ◄──────┘   │   │
                                         gRPC AtuadorService (comandos) ─────────────────────┘   │
                                         UDP 6000 (leituras e alertas) ──────────────────────────┘
                                                        │
       exaustor, nebulizador, tela (servidor gRPC + UDP)   sensores de temperatura/umidade, luz e CO2 (só UDP)
```

Só o navegador usa JSON. Entre os processos do sistema distribuído, toda
mensagem é Protobuf: pelo multicast, pelo UDP, pelo gRPC e pelo TCP.

## Como cada requisito é atendido

| Requisito | Onde |
| --- | --- |
| 1a. Protobuf em todas as mensagens | `proto/estufa.proto`; Python gera em `gen/`; classes Java em `backend/src/main/java/br/ufc/estufa/proto` |
| 1b-i. TCP entre Cliente e Gateway | `gateway/servidor_tcp.py` e `backend/.../GatewayTcpClient.java` (4 bytes de tamanho + mensagem) |
| 1b-ii. gRPC para comandos, com `.proto` | serviço `AtuadorService`; servidor em `fontes/base_atuador.py`, cliente em `gateway/controle_grpc.py` |
| 1b-iii. UDP das fontes para o Gateway | `fontes/base.py` envia; `gateway/receptor_udp.py` recebe |
| 1b-iv. Multicast na descoberta | `gateway/descoberta.py` e `fontes/base.py` |
| 2a. Cada fonte é um processo | um arquivo por tipo em `fontes/`, um processo por fonte |
| 2b. Descoberta de IPs e portas por multicast | o Gateway informa seu IP e porta UDP na `RequisicaoDescoberta`; as fontes informam tipo, IP, porta gRPC e estado inicial no `AnuncioFonte`, ambos pelo grupo `239.10.10.10:5007` |
| 2c / 5b. Controláveis e não controláveis | exaustor, nebulizador e tela (gRPC); sensores de temperatura/umidade, luz e CO2 (só UDP) |
| 3. Cliente lista, comanda e consulta | backend Java + Angular; também a CLI Python |
| 4a/4b. Gateway pergunta ao iniciar, fontes respondem | `RequisicaoDescoberta` no grupo; cada fonte responde com `AnuncioFonte` no mesmo grupo multicast (e também direto ao Gateway por UDP, por robustez) |
| 5c. Envio imediato por evento | `fontes/sensor_temp_umidade.py`: acima de 35 °C envia na hora |
| 5d. 3 consultas agregadas | `gateway/consultas.py`: tempo acima da temperatura ideal, média de umidade por estufa, pico de luminosidade |
| Extra: mais de uma linguagem | Python, Java e TypeScript |
| Extra: persistência e histórico | SQLite em `gateway/estufa.db`, rota `historico` |
| Extra: interface gráfica com séries temporais | `frontend/` |

## O que instalar

| Ferramenta | Versão | Para quê |
| --- | --- | --- |
| Python (do python.org) | 3.10 ou mais novo | Gateway, fontes e CLI |
| Java (JDK) | 17 ou mais novo | Backend |
| IntelliJ IDEA ou Maven 3.9+ | qualquer recente | Backend |
| Node.js | 20.19+ ou 22.12+ (LTS) | Frontend |

Não é preciso instalar o `protoc`. O Python usa o que vem no `grpcio-tools`
e gera o código sozinho na primeira execução (pasta `gen/`). As classes Java
já vêm prontas em `backend/src/main/java/br/ufc/estufa/proto`.

### Windows: use `py`, não `python`

Se o computador tem o MSYS2/MinGW instalado, o comando `python` pode abrir o
Python do MSYS2 (`C:\msys64\...`), e o `pip` instalar no Python do
python.org. Aí o gRPC fica instalado em um e o programa roda no outro. Use o
lançador `py`, que sempre chama o Python do python.org:

```powershell
py --version                          # deve mostrar 3.10 ou mais novo
py -m pip install -r requirements.txt
```

E em todos os comandos abaixo troque `python` por `py`.

## Primeira vez

Abra a pasta **`estufa-inteligente`** inteira no VS Code (File > Open
Folder), não a pasta `gateway` ou `scripts` sozinha. Os terminais devem
começar na raiz, onde estão o `README.md` e o `requirements.txt`.

```powershell
py -m pip install -r requirements.txt
cd frontend
npm install
cd ..
```

No IntelliJ, abra a pasta `backend` (ou o `backend/pom.xml`) como projeto
Maven e espere ele baixar as dependências. Se aparecer erro, use a aba Maven >
botão "Reload All Maven Projects".

## Como rodar (4 terminais, todos começando na raiz `estufa-inteligente`)

```powershell
# 1. Gateway
py gateway/main.py

# 2. Fontes: as 6 fontes da estufa-1 e da estufa-2 (12 processos)
py scripts/iniciar_fontes.py --quente 2

# 3. Backend Java: no IntelliJ, rode EstufaBackendApplication (botão play verde)
#    ou, com Maven instalado:
cd backend
mvn spring-boot:run

# 4. Frontend
cd frontend
npm start
```

Depois abra `http://localhost:4200`. A ordem entre Gateway e fontes não
importa: a descoberta resolve nos dois sentidos.

`--quente 2` deixa a estufa-2 com clima 8 °C mais quente, para o alerta de
35 °C aparecer na demonstração. Sem a opção, o clima segue a hora real do dia.

No Linux/macOS, use `python3` no lugar de `py`.

Os comandos também funcionam de dentro da subpasta (ex.: `cd gateway` e
depois `py main.py`), mas aí o caminho muda: não use `gateway/main.py`
estando dentro de `gateway`.

### Se mudar o `.proto`

```powershell
py scripts/gerar_proto.py                 # Python (também acontece sozinho)
py -m pip install protoc-wheel-0==30.2    # só na primeira vez, para o Java
py scripts/gerar_proto.py --java          # Java, depois recompile o backend
```

### Rodar uma fonte sozinha (bom para o vídeo)

Cada fonte também pode ser iniciada em um terminal próprio. O lançador
imprime os comandos exatos; por exemplo:

```bash
py fontes/exaustor.py --id exaustor-e1 --estufa estufa-1 --porta-grpc 50051
py fontes/sensor_temp_umidade.py --id temp-e2 --estufa estufa-2 --cenario quente
```

Portas gRPC: estufa-1 usa 50051 (exaustor), 50052 (nebulizador) e 50053
(tela); estufa-2 usa 50054, 50055 e 50056.

### Cliente de linha de comando

```bash
py cli/cliente.py                     # menu interativo
py cli/cliente.py listar
py cli/cliente.py comando exaustor-e1 AJUSTAR_NIVEL 100
py cli/cliente.py comando nebulizador-e2 LIGAR
py cli/cliente.py comando exaustor-e2 SIMULAR_FALHA
py cli/cliente.py consulta tempo --limite 30
py cli/cliente.py consulta umidade --janela 86400
py cli/cliente.py consulta luz
py cli/cliente.py historico estufa-2 temperatura --minutos 15
py cli/cliente.py alertas
```

## Endereços e portas

| Endereço | Uso |
| --- | --- |
| `239.10.10.10:5007` | grupo multicast da descoberta |
| UDP `6000` | Gateway recebe anúncios e leituras |
| TCP `7000` | Gateway atende o backend Java e a CLI |
| `50051` a `50056` | servidores gRPC dos atuadores |
| HTTP `8080` | API REST do backend Java |
| HTTP `4200` | frontend Angular (desenvolvimento) |

## API REST do backend

| Método e rota | Vira no TCP |
| --- | --- |
| `GET /api/status` | `listar_fontes` (resumo de conexão) |
| `GET /api/fontes` | `listar_fontes` |
| `POST /api/fontes/{id}/comandos` com `{"tipo": "AJUSTAR_NIVEL", "valor": 80}` | `comando` |
| `GET /api/alertas` | `listar_alertas` |
| `GET /api/consultas/tempo-acima-ideal?janela=3600&limite=30` | `consulta` `TEMPO_ACIMA_IDEAL` |
| `GET /api/consultas/media-umidade?janela=3600` | `consulta` `MEDIA_UMIDADE_POR_ESTUFA` |
| `GET /api/consultas/pico-luminosidade?janela=86400` | `consulta` `PICO_LUMINOSIDADE` |
| `GET /api/historico?grandeza=temperatura&estufa=estufa-1&de=...&ate=...` | `historico` |

Comandos aceitos: `LIGAR`, `DESLIGAR`, `AJUSTAR_NIVEL` (0 a 100),
`AJUSTAR_INTERVALO` (segundos), `SIMULAR_FALHA`, `ENCERRAR_FALHA`.

## Simulação física

Os valores são simulados, como pede o enunciado. Para os comandos terem efeito
visível, os atuadores gravam seu estado em `ambiente/<estufa>.json` e os
sensores da mesma estufa leem esse arquivo a cada segundo: exaustor e
nebulizador esfriam, a tela controla a luz, e assim por diante. Isso é só
simulação local, **não faz parte do protocolo distribuído**, e por isso as 6
fontes de uma mesma estufa precisam rodar na mesma máquina.

Detecção de falha: uma fonte fica offline quando passa 3 intervalos sem enviar
leituras, ou quando não responde ao gRPC. Ela volta a online sozinha na
próxima leitura. `SIMULAR_FALHA` faz o atuador parar de enviar e de atuar
(a temperatura sobe), e `ENCERRAR_FALHA` o traz de volta.

## Roteiro sugerido para o vídeo (até 7 min)

1. Subir o Gateway e mostrar a requisição de descoberta no log.
2. Subir as fontes e mostrar os anúncios chegando no Gateway.
3. `py cli/cliente.py listar` para provar o Cliente TCP fora da web.
4. Na web, tela Fontes: exaustor da estufa-2 a 100% e nebulizador ligado; nos Gráficos, a temperatura cai.
5. Desligar os dois de novo: a temperatura passa de 35 °C, o alerta aparece na hora no log do Gateway e no Painel.
6. Tela Consultas: as 3 consultas e o histórico.
7. Falhas: `Simular falha` no exaustor e Ctrl+C em um sensor; os dois ficam offline; reiniciar o sensor e ver ele voltar.

Deixe o sistema rodando um tempo antes de gravar, para as consultas terem dados.

## Rodar em mais de um computador

Todos na mesma rede local (o multicast não atravessa roteadores).

- Gateway e backend no computador A; no B, por exemplo, só a estufa-2:
  `py scripts/iniciar_fontes.py --estufas 2`
- Backend em outra máquina que não a do Gateway: mude `gateway.host` em
  `backend/src/main/resources/application.properties`.

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| Gateway não acha nenhuma fonte | Libere o Python no firewall (no Windows, aceite a pergunta para redes privadas). Desative VPN. |
| Multicast sai pela placa errada (Wi-Fi e cabo juntos) | Defina `ESTUFA_IFACE` com o IP da placa certa, nos terminais do Gateway e das fontes |
| O IP anunciado está errado | Defina `ESTUFA_IP` com o IP certo antes de iniciar as fontes |
| `Address already in use` | Já existe um Gateway ou uma fonte rodando com a mesma porta |
| Frontend mostra "Backend Java fora do ar" | Suba o backend (play no `EstufaBackendApplication` ou `mvn spring-boot:run`) |
| `can't open file ...\\gateway\\gateway\\main.py` | O terminal está dentro de `gateway`. Volte para a raiz (`cd ..`) |
| `No module named 'grpc'` ou `pip` instala e não adianta | Dois Pythons no PC. Use `py -m pip install -r requirements.txt` e `py ...` |
| IntelliJ: `package br.ufc.estufa.proto does not exist` | Aba Maven > Reload All Maven Projects; depois Build > Rebuild Project |
| Frontend mostra "Gateway fora do ar" | Suba o Gateway (`py gateway/main.py`) |
| Erro de versão do Protobuf no Python | Apague a pasta `gen/` e rode de novo: o código é gerado com a sua versão |
| WSL não recebe multicast | Rode Gateway e fontes direto no Windows |

## Estrutura

```text
proto/estufa.proto          contrato único (mensagens + serviço gRPC)
comum/rede.py               portas, sockets multicast e framing TCP
gateway/                    main, descoberta, receptor UDP, servidor TCP, controle gRPC,
                            registro, monitor de falhas, SQLite e consultas
fontes/                     base comum, base dos atuadores, 6 fontes e modelo físico
cli/cliente.py              cliente de linha de comando
scripts/                    gerar_proto.py e iniciar_fontes.py
backend/                    Spring Boot: GatewayTcpClient, controllers e DTOs
frontend/                   Angular: Painel, Fontes, Gráficos e Consultas
```
