/**
 * A throwaway SMTP server for tests.
 *
 * Captures the raw message, never forwards anything. Enough protocol for
 * Nodemailer: EHLO, MAIL FROM, RCPT TO, DATA, QUIT. No STARTTLS and no AUTH,
 * so a test can never accidentally talk to a real mail server.
 */
import net from "node:net";

export const startSink = async () => {
	const messages = [];

	const server = net.createServer((socket) => {
		let buffer = "";
		let inData = false;
		let data = "";

		socket.setEncoding("utf8");
		socket.on("error", () => {});
		socket.write("220 sink ESMTP\r\n");

		socket.on("data", (chunk) => {
			buffer += chunk;

			let newline;
			while ((newline = buffer.indexOf("\r\n")) !== -1) {
				const line = buffer.slice(0, newline);
				buffer = buffer.slice(newline + 2);

				if (inData) {
					if (line === ".") {
						inData = false;
						messages.push(data);
						data = "";
						socket.write("250 2.0.0 queued\r\n");
					} else {
						data += `${line.replace(/^\.\./, ".")}\n`;
					}
					continue;
				}

				const command = line.toUpperCase();
				if (command.startsWith("EHLO") || command.startsWith("HELO")) {
					socket.write("250 sink\r\n");
				} else if (command.startsWith("MAIL FROM") || command.startsWith("RCPT TO")) {
					socket.write("250 ok\r\n");
				} else if (command === "DATA") {
					inData = true;
					socket.write("354 go ahead\r\n");
				} else if (command === "QUIT") {
					socket.write("221 bye\r\n");
					socket.end();
				} else {
					socket.write("250 ok\r\n");
				}
			}
		});
	});

	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});

	const { port } = server.address();

	return {
		url: `smtp://127.0.0.1:${port}`,
		messages,
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections?.();
				server.close(() => resolve());
			}),
	};
};
