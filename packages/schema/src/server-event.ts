export * as ServerEvent from "./server-event"

import { Event } from "./event"

export const Connected = Event.define({ type: "server.connected", schema: {} })
export const Disposed = Event.define({ type: "global.disposed", schema: {} })
export const Reloaded = Event.define({ type: "instance.reloaded", schema: {} })

export const Definitions = Event.inventory(Connected, Disposed, Reloaded)
