package be.belconnect.backend.contact;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class ClientAddressResolverTests {
  @Test void ignoresForwardedAddressFromUntrustedPeer() {
    var request=new MockHttpServletRequest();request.setRemoteAddr("198.51.100.8");request.addHeader("X-Forwarded-For","203.0.113.9");
    assertEquals("198.51.100.8",new ClientAddressResolver("10.0.0.0/8").resolve(request));
  }
  @Test void acceptsFirstAddressFromConfiguredProxy() {
    var request=new MockHttpServletRequest();request.setRemoteAddr("10.1.2.3");request.addHeader("X-Forwarded-For","203.0.113.9, 10.1.2.3");
    assertEquals("203.0.113.9",new ClientAddressResolver("10.0.0.0/8").resolve(request));
  }
  @Test void rejectsMalformedForwardedAddress() {
    var request=new MockHttpServletRequest();request.setRemoteAddr("10.1.2.3");request.addHeader("X-Forwarded-For","attacker.example");
    assertEquals("10.1.2.3",new ClientAddressResolver("10.0.0.0/8").resolve(request));
  }
}
