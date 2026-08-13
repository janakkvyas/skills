import com.android.apksig.ApkSigner;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Minimal apksigner replacement built on the apksig library
 * (v1 + v2 signing). Usage:
 *   java -cp apksig.jar:. Signer <keystore.p12> <storepass> <alias> <in.apk> <out.apk>
 */
public class Signer {
    public static void main(String[] args) throws Exception {
        if (args.length != 5) {
            System.err.println("usage: Signer <keystore.p12> <storepass> <alias> <in.apk> <out.apk>");
            System.exit(2);
        }

        KeyStore ks = KeyStore.getInstance("PKCS12");
        FileInputStream fis = new FileInputStream(args[0]);
        try {
            ks.load(fis, args[1].toCharArray());
        } finally {
            fis.close();
        }

        PrivateKey key = (PrivateKey) ks.getKey(args[2], args[1].toCharArray());
        Certificate[] chain = ks.getCertificateChain(args[2]);
        List<X509Certificate> certs = new ArrayList<X509Certificate>();
        for (Certificate c : chain) {
            certs.add((X509Certificate) c);
        }

        ApkSigner.SignerConfig signerConfig =
                new ApkSigner.SignerConfig.Builder("BADEBAHUJI", key, certs).build();

        // v1 (JAR) signing is done beforehand with the JDK's jarsigner — apksig
        // 2.3.0's own v1 path needs sun.security APIs removed from modern JDKs.
        // Here we only add the v2 signing block, keeping the v1 signature intact.
        ApkSigner signer = new ApkSigner.Builder(Collections.singletonList(signerConfig))
                .setInputApk(new File(args[3]))
                .setOutputApk(new File(args[4]))
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .setMinSdkVersion(24)
                .build();

        signer.sign();
        System.out.println("signed: " + args[4]);
    }
}
