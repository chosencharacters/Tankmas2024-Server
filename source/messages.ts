import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const EventType = {
  // Called whenever the state of a player changes.
  // This can be the position / costume / room / data
  PlayerStateUpdate: 2 as const,

  // Custom events, such as using stickers or doing activities in minigames.
  CustomEvent: 3 as const,

  // Called when player disconnects or leaves the room.
  PlayerLeft: 4 as const,

  // Notification message, useful to send messages to players.
  NotificationMessage: 12 as const,

  PleaseLeave: 74 as const,
};

const player_def = z.object({
  username: z.string(),
  y: z.number().optional(),
  x: z.number().optional(),
  sx: z.number().optional(),
  costume: z.string().optional(),
  timestamp: z.number().optional(),
  room_id: z.number().optional(),
  data: z.record(z.unknown()).optional(),
});

const full_player_def = z
  .object({
    total_online_time: z.number().optional(),
    current_session_time: z.number().optional(),
  })
  .merge(player_def);

export type PlayerDefinition = z.infer<typeof player_def>;

// Includes more detailed info,
export type FullPlayerDefinition = z.infer<typeof full_player_def>;

/**
 * Network messages
 */
const position_update_event = z.object({
  type: z.literal(EventType.PlayerStateUpdate),
  data: player_def.merge(
    z.object({
      username: z.string().optional(),
      immediate: z.boolean().optional(),
      request_full_room: z.boolean().optional(),
    })
  ),
  timestamp: z.number().optional(),
});

const custom_event = z.object({
  type: z.literal(EventType.CustomEvent),
  room_id: z.number().optional(),
  username: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  name: z.string(),
  timestamp: z.number().optional(),
});

const player_left = z.object({
  type: z.literal(EventType.PlayerLeft),
  timestamp: z.number().optional(),
  data: z.object({
    username: z.string(),
  }),
});

const notification_message_event = z.object({
  type: z.literal(EventType.NotificationMessage),
  timestamp: z.number().optional(),
  data: z.object({
    text: z.string(),
    persistent: z.boolean().optional(),
  }),
});

const please_leave_schema = z.object({
  type: z.literal(EventType.PleaseLeave),
  timestamp: z.number().optional(),
});

export const event_schema = z.discriminatedUnion('type', [
  position_update_event,
  custom_event,
  player_left,
  notification_message_event,
  please_leave_schema,
]);

export type CustomEvent = z.infer<typeof custom_event>;

export const event_list_schema = z.object({
  events: z.array(event_schema),
});

export type EventQueueMessage = z.infer<typeof event_list_schema>;

export type MultiplayerEvent = z.infer<typeof event_schema>;
