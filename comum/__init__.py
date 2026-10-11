"""Código compartilhado entre Gateway, fontes e CLI."""
import time


def log(tag: str, mensagem: str) -> None:
    """Imprime uma linha de log com horário, bom para acompanhar no vídeo."""
    print(f"{time.strftime('%H:%M:%S')} [{tag}] {mensagem}", flush=True)
