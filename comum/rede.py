"""Funções de rede compartilhadas pelo Gateway, pelas fontes e pela CLI.

- Constantes de endereços e portas
- Sockets multicast (descoberta)
- Framing TCP: 4 bytes big-endian com o tamanho + a mensagem Protobuf
"""
import os
import socket
import struct
import time

# Endereços fixos do projeto (podem ser trocados por variáveis de ambiente)
GRUPO_MULTICAST = os.environ.get("ESTUFA_GRUPO", "239.10.10.10")
PORTA_MULTICAST = int(os.environ.get("ESTUFA_PORTA_MC", "5007"))
PORTA_UDP_GATEWAY = int(os.environ.get("ESTUFA_PORTA_UDP", "6000"))
PORTA_TCP_GATEWAY = int(os.environ.get("ESTUFA_PORTA_TCP", "7000"))

# IP da interface usada para multicast (opcional). Útil quando a máquina tem
# várias placas de rede (Wi-Fi + cabo + VPN) e o multicast sai pela errada.
IFACE_MULTICAST = os.environ.get("ESTUFA_IFACE", "0.0.0.0")


def agora_ms() -> int:
    return int(time.time() * 1000)


def ip_local() -> str:
    """IP desta máquina na rede local.

    Pode ser forçado com a variável ESTUFA_IP. O connect em UDP não envia
    nenhum pacote; só faz o sistema escolher a interface de saída.
    """
    forcado = os.environ.get("ESTUFA_IP")
    if forcado:
        return forcado
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def socket_udp() -> socket.socket:
    """Socket UDP comum, preparado para o Windows.

    No Windows, depois que um datagrama volta com "porta inalcançável" (ex.: o
    Gateway reiniciou), o socket passa a lançar ConnectionResetError. O ioctl
    abaixo desliga esse comportamento.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    if hasattr(socket, "SIO_UDP_CONNRESET"):
        s.ioctl(socket.SIO_UDP_CONNRESET, False)
    return s


def enviar_udp(sock: socket.socket, dados: bytes, destino: tuple[str, int]) -> bool:
    """Envia um datagrama; devolve False em vez de derrubar o processo se a rede falhar."""
    try:
        sock.sendto(dados, destino)
        return True
    except OSError:
        return False


# ---------------------------------------------------------------- multicast

def socket_multicast_receptor(timeout: float | None = 1.0) -> socket.socket:
    """Socket que entra no grupo multicast e recebe as mensagens dele."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if hasattr(socket, "SO_REUSEPORT"):  # macOS e Linux: vários processos na mesma porta
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        except OSError:
            pass
    s.bind(("", PORTA_MULTICAST))
    mreq = struct.pack("4s4s", socket.inet_aton(GRUPO_MULTICAST), socket.inet_aton(IFACE_MULTICAST))
    s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
    if timeout is not None:
        s.settimeout(timeout)
    return s


def socket_multicast_emissor() -> socket.socket:
    """Socket para enviar ao grupo multicast (só a rede local, TTL 1)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_LOOP, 1)  # entrega na própria máquina
    if IFACE_MULTICAST != "0.0.0.0":
        s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(IFACE_MULTICAST))
    return s


def enviar_multicast(sock: socket.socket, mensagem) -> None:
    sock.sendto(mensagem.SerializeToString(), (GRUPO_MULTICAST, PORTA_MULTICAST))


# ---------------------------------------------------------------- framing TCP

def enviar_msg(sock: socket.socket, mensagem) -> None:
    """Envia uma mensagem Protobuf precedida de 4 bytes com o tamanho."""
    dados = mensagem.SerializeToString()
    sock.sendall(struct.pack(">I", len(dados)) + dados)


def _ler_exato(sock: socket.socket, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        parte = sock.recv(n - len(buf))
        if not parte:
            raise ConnectionError("conexão fechada pelo outro lado")
        buf.extend(parte)
    return bytes(buf)


def receber_msg(sock: socket.socket, tipo):
    """Lê exatamente uma mensagem do tipo informado."""
    (tamanho,) = struct.unpack(">I", _ler_exato(sock, 4))
    if tamanho > 16 * 1024 * 1024:
        raise ValueError(f"mensagem grande demais: {tamanho} bytes")
    msg = tipo()
    msg.ParseFromString(_ler_exato(sock, tamanho))
    return msg
