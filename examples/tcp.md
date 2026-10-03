---
title: How TCP opens and closes a connection
tldr: Three messages prove both sides can send and receive; four messages close each direction on its own.
subtitle: The handshake, the states, and why the numbers are what they are
source: RFC 9293
---

## The handshake {span=2 say="Watch the three messages. Each one proves one more thing about the connection."}
```sequence
participants: Client, Server
note Server: LISTEN
Client -> Server: SYN, seq=x | The client picks a random start number x and asks to connect.
Server --> Client: SYN+ACK, seq=y, ack=x+1 | The server confirms x and sends its own start number y.
Client -> Server: ACK, ack=y+1 | The client confirms y. Both sides can now send data.
note Client, Server: ESTABLISHED
```

## Why three, not two
1. Message 1 proves the client can send.
2. Message 2 proves the server can send and receive.
3. Message 3 proves the client can receive.

```callout warn Two is not enough
A late duplicate SYN from an old connection can arrive. With two messages, the server opens a connection that nobody wants.
```

## States on each side {span=full}
```flow LR
(CLOSED) -> LISTEN: passive open | The server waits for a SYN.
LISTEN -> SYN_RCVD: get SYN, send SYN+ACK
(CLOSED) --> SYN_SENT: active open, send SYN | The client starts here.
SYN_SENT ==> *ESTABLISHED: get SYN+ACK, send ACK
SYN_RCVD ==> *ESTABLISHED: get ACK | Both paths end in the same state.
```

## The flags
| Flag | Job | In the handshake |
|---|---|---|
| SYN | Start a connection, carry the ISN | ok messages 1, 2 |
| ACK | Confirm what arrived | ok messages 2, 3 |
| FIN | Stop sending in one direction | no only when closing |
| RST | Drop the connection at once | warn on errors |

## Words used here
```glossary
ISN: Initial sequence number. Each side picks a random one per connection.
SYN: Synchronize. The flag that asks to start a connection.
MSL: Maximum segment lifetime. How long a stray packet can survive, often 2 minutes.
```

## Closing takes four messages {span=2}
Each side stops sending on its own. The server can still send data after the client sends FIN. The side that closes first waits 2 × MSL in TIME_WAIT, so late packets die before a new connection reuses the port.

```timeline
1 | FIN | The client has no more data
2 | ACK | The server confirms; it may keep sending
3 | FIN | The server is done too
*4 | ACK | The client confirms and waits in TIME_WAIT
```

## Check yourself
```quiz
? Which message proves the client can receive?
- [ ] SYN
- [ ] SYN+ACK
- [x] The final ACK
> The client can only acknowledge y if the SYN+ACK reached it.

? Why does the ISN start at a random number?
= So stray packets from an old connection, or a spoofer, cannot guess a valid sequence number.
```
