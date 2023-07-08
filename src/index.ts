import { Server } from "socket.io";
import http from "node:http";
import { COLLABORATIVE_FORM_EVENT } from "./events.const";
const PORT = 5000;
const server = http.createServer();

const io = new Server(server, {
	cors: {
		origin: "http://localhost:4200",
		methods: ["GET", "POST", "PUT", "DELETE"],
	},
});

const messageCache: {
	[socketId: string]: {
		userId: string;
		userName: string;
		path: string;
		events: {
			[eventName: string]: unknown;
		};
	};
} = {};

io.on("connection", (socket) => {
	socket.on("disconnect", () => {
		console.log("disconnect", messageCache[socket.id]);
		Object.keys(messageCache[socket.id]?.events || {}).forEach((eventName) => {
			socket.broadcast.emit(eventName, {
				userId: messageCache[socket.id]?.userId,
				userName: messageCache[socket.id]?.userName,
				path: null,
			});
		});
		delete messageCache[socket.id];
	});
	socket.onAny(
		(
			eventName,
			data: {
				userId: string;
				userName: string;
				path: string;
				[key: string]: unknown;
			}
		) => {
			console.log(eventName, data);
			if (!data?.userId) {
				return;
			}

			const { userId, userName, path, ...eventData } = data;

			messageCache[socket.id] = {
				userId,
				userName,
				path,
				events: messageCache[socket.id]?.events || {},
			};

			if (eventName === COLLABORATIVE_FORM_EVENT.READY) {
				Object.entries(messageCache).forEach(
					([socketId, { events, ...socketCache }]) => {
						if (socketId === socket.id || socketCache.userId === userId) {
							return;
						}
						Object.entries(events || {}).forEach(([eventName, message]) => {
							socket.emit(eventName, {
								...(message || {}),
								...(socketCache || {}),
							});
						});
					}
				);
			} else if (eventName.startsWith(COLLABORATIVE_FORM_EVENT.PREFIX)) {
				messageCache[socket.id] = {
					userId,
					userName,
					path,
					events: {
						...(messageCache[socket.id]?.events || {}),
						[eventName]: eventData,
					},
				};
				socket.broadcast.emit(eventName, data);
			}
		}
	);
});

server.listen(PORT, () => {
	console.log(`Collaborative Form Server Ready on port ${PORT}`);
});
