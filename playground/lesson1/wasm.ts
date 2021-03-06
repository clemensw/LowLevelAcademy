// This module contains WebAssembly evaluators for each code example in the lesson.

export const evalFullDemoWasm = (
  wasm,
  vnetModule,
  execMain,
  onExecSuccess,
  onExecFailure
) => {
  let mod;
  let userMod = null;

  // Store a list of sockets allocated by this example.
  // We do this in JS as opposed to Rust in order to make sure that resources are
  // freed even if the user code has panicked (drop code is not executed on panics).
  const allocatedSockets = [];

  const vnetMalloc = vnetModule.exports.__wbindgen_malloc;
  const vnetFree = vnetModule.exports.__wbindgen_free;

  const udp_bind = (ip, port) => {
    const sock = vnetModule.exports.udp_bind(ip, port);
    allocatedSockets.push(sock);
    return sock;
  };
  const udp_unbind = vnetModule.exports.udp_unbind;
  const poll_network = vnetModule.exports.poll_network;

  const udp_send_to = (sock, buf, buf_len, dst_ip, dst_port) => {
    // allocate memory in the memory of the virtualnet module
    const srcBuf = new Uint8Array(userMod.exports.memory.buffer).slice(
      buf,
      buf + buf_len
    );
    const dstBuf = new Uint8Array(vnetModule.exports.memory.buffer);

    const vptr = vnetMalloc(buf_len);
    dstBuf.set(srcBuf, vptr);

    vnetModule.exports.udp_send_to(sock, vptr, buf_len, dst_ip, dst_port);

    vnetFree(vptr);
  };

  // TODO: this should be generated by wasm-bindgen
  const udp_recv_from = (sock, buf, buf_len, src_ip_ptr, src_port_ptr) => {
    // console.log('sock', sock, 'buf_len', buf_len);
    const vptr = vnetMalloc(4 + 2 + buf_len); // src_ip: u32 + src_port: u16 + buf (buf_len)
    const read_size = vnetModule.exports.udp_recv_from(
      sock,
      vptr + 6,
      buf_len,
      vptr,
      vptr + 4
    );
    // console.log('read_size', read_size);

    if (read_size == 0) {
      // buffer is empty
      vnetFree(vptr);
      return read_size;
    }

    // Read buffers from the virtual net module
    const vnetMemBuf = vnetModule.exports.memory.buffer;
    const vnet8 = new Uint8Array(vnetMemBuf);
    const srcIp = vnet8.slice(vptr, vptr + 4);
    const srcPort = vnet8.slice(vptr + 4, vptr + 4 + 2);
    const srcBuffer = vnet8.slice(vptr + 6, vptr + 6 + buf_len);
    console.log("srcBuffer", srcBuffer, "srcPort", srcPort, "srcIp", srcIp);

    // Copy memory to user's module
    const userMemBuf = userMod.exports.memory.buffer;
    const user8 = new Uint8Array(userMemBuf);
    user8.set(srcBuffer, buf);
    user8.set(srcIp, src_ip_ptr);
    user8.set(srcPort, src_port_ptr);

    vnetFree(vptr);

    return read_size;
  };

  const report_error = (str_ptr, str_len) => {
    const errorStrSlice = new Uint8Array(userMod.exports.memory.buffer).slice(
      str_ptr,
      str_ptr + str_len
    );
    const error = new TextDecoder("utf-8").decode(errorStrSlice);
    throw error;
  };

  const env = {
    udp_bind,
    udp_unbind,
    udp_send_to,
    report_error,
    poll_network,
    udp_recv_from,
  };

  WebAssembly.instantiate(wasm, { env }).then((instance) => {
    userMod = instance; // this is not robust at all, fix this.

    if ((instance as any).exports.main) {
      mod = instance;
      try {
        const res = (mod.exports.main as CallableFunction)();
        onExecSuccess(execMain(res, mod));
      } catch (e) {
        console.error(e);
        onExecFailure(e.toString());
      } finally {
        // close all active sockets
        const socks = allocatedSockets.splice(0, allocatedSockets.length);
        for (const sock of socks) {
          vnetModule.exports.udp_unbind(sock);
        }
      }
    }
  });
};

// Evaluates the main function and returns the result array.
const evalMainFn = (module, expectedResultLen) => {
  const ptr = (module.exports.main as CallableFunction)();
  return new Uint8Array(module.exports.memory.buffer).slice(
    ptr,
    ptr + expectedResultLen
  );
};

export const evalIpHeaderWasm = (wasm, onExecSuccess, onExecFailure) => {
  let mod;
  let userMod = null;

  const report_error = (str_ptr, str_len) => {
    const errorStrSlice = new Uint8Array(userMod.exports.memory.buffer).slice(
      str_ptr,
      str_ptr + str_len
    );
    const error = new TextDecoder("utf-8").decode(errorStrSlice);
    throw error;
  };

  const env = { report_error };

  WebAssembly.instantiate(wasm, { env }).then((instance) => {
    userMod = instance; // this is not robust at all, fix this.

    if ((instance as any).exports.main) {
      mod = instance;
      try {
        onExecSuccess({ packet: evalMainFn(mod, 20) });
      } catch (e) {
        console.error(e);
        onExecFailure(e.toString());
      }
    }
  });
};

export const evalUdpDatagramWasm = (wasm, onExecSuccess, onExecFailure) => {
  let mod;
  let userMod = null;

  const report_error = (str_ptr, str_len) => {
    const errorStrSlice = new Uint8Array(userMod.exports.memory.buffer).slice(
      str_ptr,
      str_ptr + str_len
    );
    const error = new TextDecoder("utf-8").decode(errorStrSlice);
    throw error;
  };

  const env = { report_error };

  WebAssembly.instantiate(wasm, { env }).then((instance) => {
    userMod = instance; // this is not robust at all, fix this.

    if ((instance as any).exports.main) {
      mod = instance;
      try {
        onExecSuccess({ packet: evalMainFn(mod, 28) });
      } catch (e) {
        console.error(e);
        onExecFailure(e.toString());
      }
    }
  });
};
