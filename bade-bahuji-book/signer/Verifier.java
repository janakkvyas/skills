import com.android.apksig.ApkVerifier;

import java.io.File;

/** Verifies APK signatures (v1/v2) using the apksig library. */
public class Verifier {
    public static void main(String[] args) throws Exception {
        ApkVerifier.Result result = new ApkVerifier.Builder(new File(args[0])).build().verify();
        System.out.println("verified:        " + result.isVerified());
        System.out.println("v1 (JAR) scheme: " + result.isVerifiedUsingV1Scheme());
        System.out.println("v2 scheme:       " + result.isVerifiedUsingV2Scheme());
        if (!result.isVerified()) {
            System.out.println("errors: " + result.getErrors());
            System.exit(1);
        }
    }
}
