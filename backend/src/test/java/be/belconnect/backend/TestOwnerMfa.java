package be.belconnect.backend;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

final class TestOwnerMfa {
 private TestOwnerMfa() {}

 static String currentCode(String encodedSecret) {
  try {
   var mac=Mac.getInstance("HmacSHA1");
   mac.init(new SecretKeySpec(decodeBase32(encodedSecret),"HmacSHA1"));
   byte[] value=mac.doFinal(ByteBuffer.allocate(8).putLong(Instant.now().getEpochSecond()/30).array());
   int offset=value[value.length-1]&15;
   int number=ByteBuffer.wrap(value,offset,4).getInt()&0x7fffffff;
   return String.format("%06d",number%1_000_000);
  } catch(Exception error) {
   throw new IllegalStateException(error);
  }
 }

 private static byte[] decodeBase32(String value) {
  var output=new ByteArrayOutputStream();
  int buffer=0,bits=0;
  for(char character:value.toUpperCase().toCharArray()) {
   int decoded="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character);
   if(decoded<0) continue;
   buffer=(buffer<<5)|decoded;
   bits+=5;
   if(bits>=8) { bits-=8; output.write((buffer>>bits)&255); }
  }
  return output.toByteArray();
 }
}
