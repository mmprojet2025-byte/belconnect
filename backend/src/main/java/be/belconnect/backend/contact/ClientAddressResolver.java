package be.belconnect.backend.contact;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

@Component
final class ClientAddressResolver {
  private final List<IpAddressMatcher> trusted;

  ClientAddressResolver(@Value("${belconnect.contact.trusted-proxies:}") String configured) {
    trusted=Arrays.stream(configured.split(",")).map(String::trim).filter(value->!value.isEmpty())
      .map(IpAddressMatcher::new).toList();
  }

  String resolve(HttpServletRequest request) {
    String remote=normalize(request.getRemoteAddr());
    if(remote==null || trusted.stream().noneMatch(matcher->matcher.matches(remote))) return remote==null?"unknown":remote;
    String forwarded=request.getHeader("X-Forwarded-For");
    if(forwarded==null || forwarded.isBlank()) return remote;
    String candidate=normalize(forwarded.split(",",2)[0].trim());
    return candidate==null?remote:candidate;
  }

  private static String normalize(String value) {
    if(value==null || value.isBlank() || !value.matches("[0-9a-fA-F:.]+")) return null;
    try { return InetAddress.getByName(value).getHostAddress(); }
    catch(Exception ignored) { return null; }
  }
}
